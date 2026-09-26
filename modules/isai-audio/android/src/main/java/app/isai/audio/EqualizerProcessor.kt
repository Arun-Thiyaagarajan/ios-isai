package app.isai.audio

import androidx.media3.common.C
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.common.audio.BaseAudioProcessor
import androidx.media3.common.util.UnstableApi
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.cos
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

/** Settings sent from JS (see `effectsForNative` in src/features/audio/equalizer.ts). */
data class EffectsSettings(
  val enabled: Boolean = false,
  val bandsDb: DoubleArray = DoubleArray(10),
  val bassDb: Double = 0.0,
  val preampDb: Double = 0.0,
  /** "off", "track" or "album". */
  val replayGain: String = "off",
)

/**
 * Current effects and the playing song's levelling gains. Written from the main thread, read on
 * the audio thread; a new `version` tells the processor to redesign its filters.
 */
object AudioEffects {
  @Volatile var settings = EffectsSettings()
    private set
  @Volatile var trackGainDb = 0.0
  @Volatile var albumGainDb = 0.0
  @Volatile var version = 0
    private set

  fun update(new: EffectsSettings) {
    settings = new
    version++
  }

  /** Called when a new song starts (its gains travel in the media item's extras). */
  fun setSongGains(track: Double, album: Double) {
    trackGainDb = track
    albumGainDb = album
    version++
  }
}

/** A second-order IIR filter (RBJ audio EQ cookbook), transposed direct form II. */
class Biquad {
  var b0 = 1f; var b1 = 0f; var b2 = 0f; var a1 = 0f; var a2 = 0f
  private var z1 = 0f
  private var z2 = 0f
  val isBypass get() = b0 == 1f && b1 == 0f && b2 == 0f && a1 == 0f && a2 == 0f

  fun setBypass() = set(1.0, 0.0, 0.0, 1.0, 0.0, 0.0)

  fun peaking(frequency: Double, gainDb: Double, q: Double, sampleRate: Double) {
    val a = 10.0.pow(gainDb / 40)
    val w0 = 2 * Math.PI * min(frequency, sampleRate * 0.45) / sampleRate
    val alpha = sin(w0) / (2 * q)
    val c = cos(w0)
    set(1 + alpha * a, -2 * c, 1 - alpha * a, 1 + alpha / a, -2 * c, 1 - alpha / a)
  }

  fun lowShelf(frequency: Double, gainDb: Double, sampleRate: Double) {
    val a = 10.0.pow(gainDb / 40)
    val w0 = 2 * Math.PI * frequency / sampleRate
    val c = cos(w0)
    val alpha = sin(w0) / 2 * sqrt(2.0) // shelf slope 1
    val k = 2 * sqrt(a) * alpha
    set(
      a * ((a + 1) - (a - 1) * c + k),
      2 * a * ((a - 1) - (a + 1) * c),
      a * ((a + 1) - (a - 1) * c - k),
      (a + 1) + (a - 1) * c + k,
      -2 * ((a - 1) + (a + 1) * c),
      (a + 1) + (a - 1) * c - k,
    )
  }

  /** New coefficients; the running state is kept so changes don't click. */
  private fun set(nb0: Double, nb1: Double, nb2: Double, na0: Double, na1: Double, na2: Double) {
    b0 = (nb0 / na0).toFloat(); b1 = (nb1 / na0).toFloat(); b2 = (nb2 / na0).toFloat()
    a1 = (na1 / na0).toFloat(); a2 = (na2 / na0).toFloat()
  }

  fun reset() {
    z1 = 0f; z2 = 0f
  }

  fun process(x: Float): Float {
    val y = b0 * x + z1
    z1 = b1 * x - a1 * y + z2
    z2 = b2 * x - a2 * y
    return y
  }
}

/**
 * Equalizer, bass boost, overall gain and volume levelling for ExoPlayer. Works on 16-bit and
 * float PCM (whatever the decoder produces) and outputs the same format.
 */
@UnstableApi
class EqualizerProcessor : BaseAudioProcessor() {
  private var sampleRate = 44_100.0
  private var channels = 2
  private var appliedVersion = -1
  private var active = false
  private var linearGain = 1f
  /** [channel][filter]: bass shelf, then the 10 bands. */
  private var filters: Array<Array<Biquad>> = emptyArray()

  override fun onConfigure(inputAudioFormat: AudioProcessor.AudioFormat): AudioProcessor.AudioFormat {
    if (inputAudioFormat.encoding != C.ENCODING_PCM_16BIT && inputAudioFormat.encoding != C.ENCODING_PCM_FLOAT) {
      // Other formats (e.g. 24-bit) play untouched: an inactive processor is skipped, whereas
      // throwing here would stop playback.
      return AudioProcessor.AudioFormat.NOT_SET
    }
    sampleRate = inputAudioFormat.sampleRate.toDouble()
    channels = inputAudioFormat.channelCount
    filters = Array(channels) { Array(11) { Biquad() } }
    appliedVersion = -1
    return inputAudioFormat
  }

  private fun applySettings() {
    val s = AudioEffects.settings
    val levelling = when (s.replayGain) {
      "track" -> AudioEffects.trackGainDb
      "album" -> AudioEffects.albumGainDb
      else -> 0.0
    }
    val gainDb = (if (s.enabled) s.preampDb else 0.0) + levelling
    linearGain = 10.0.pow(gainDb / 20).toFloat()
    active = s.enabled || abs(levelling) > 0.01
    for (channel in filters) {
      if (s.enabled && abs(s.bassDb) > 0.05) channel[0].lowShelf(100.0, s.bassDb, sampleRate) else channel[0].setBypass()
      for (i in 0 until 10) {
        val db = if (s.enabled) s.bandsDb.getOrElse(i) { 0.0 } else 0.0
        if (abs(db) > 0.05) channel[i + 1].peaking(BAND_FREQUENCIES[i], db, BAND_Q, sampleRate) else channel[i + 1].setBypass()
      }
    }
  }

  private fun processSample(x: Float, channel: Int): Float {
    var y = x * linearGain
    for (filter in filters[channel]) {
      if (!filter.isBypass) y = filter.process(y)
    }
    // Last-resort safety: never send samples beyond full scale to the output.
    return y.coerceIn(-1f, 1f)
  }

  override fun queueInput(inputBuffer: ByteBuffer) {
    if (AudioEffects.version != appliedVersion) {
      appliedVersion = AudioEffects.version
      applySettings()
    }
    val remaining = inputBuffer.remaining()
    if (remaining == 0) return
    val output = replaceOutputBuffer(remaining)
    if (!active || filters.isEmpty()) {
      output.put(inputBuffer)
      output.flip()
      return
    }
    val input = inputBuffer.order(ByteOrder.nativeOrder())
    output.order(ByteOrder.nativeOrder())
    var channel = 0
    if (inputAudioFormat.encoding == C.ENCODING_PCM_FLOAT) {
      while (input.remaining() >= 4) {
        output.putFloat(processSample(input.float, channel))
        channel = (channel + 1) % channels
      }
    } else {
      while (input.remaining() >= 2) {
        val sample = input.short / 32768f
        output.putShort((processSample(sample, channel) * 32767f).toInt().toShort())
        channel = (channel + 1) % channels
      }
    }
    output.flip()
  }

  override fun onFlush() {
    for (channel in filters) for (filter in channel) filter.reset()
  }

  override fun onReset() {
    filters = emptyArray()
  }

  companion object {
    val BAND_FREQUENCIES = doubleArrayOf(31.0, 62.0, 125.0, 250.0, 500.0, 1000.0, 2000.0, 4000.0, 8000.0, 16000.0)
    const val BAND_Q = 1.1

  }
}
