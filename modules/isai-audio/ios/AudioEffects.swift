import AVFoundation
import MediaToolbox
import os

/// Settings sent from JS (see `effectsForNative` in src/features/audio/equalizer.ts).
struct EffectsSettings {
  var enabled = false
  var bandsDb: [Double] = Array(repeating: 0, count: 10)
  var bassDb: Double = 0
  var preampDb: Double = 0
  /// "off", "track" or "album".
  var replayGain = "off"

  init() {}

  init(_ dict: [String: Any]) {
    enabled = dict["enabled"] as? Bool ?? false
    bandsDb = (dict["bandsDb"] as? [NSNumber])?.map(\.doubleValue) ?? Array(repeating: 0, count: 10)
    bassDb = (dict["bassDb"] as? NSNumber)?.doubleValue ?? 0
    preampDb = (dict["preampDb"] as? NSNumber)?.doubleValue ?? 0
    replayGain = dict["replayGain"] as? String ?? "off"
  }
}

/// A second-order IIR filter (RBJ audio EQ cookbook), transposed direct form II.
struct Biquad {
  var b0: Float = 1, b1: Float = 0, b2: Float = 0, a1: Float = 0, a2: Float = 0
  var z1: Float = 0, z2: Float = 0

  static let bypass = Biquad()

  static func peaking(frequency: Double, gainDb: Double, q: Double, sampleRate: Double) -> Biquad {
    let a = pow(10, gainDb / 40)
    let w0 = 2 * Double.pi * min(frequency, sampleRate * 0.45) / sampleRate
    let alpha = sin(w0) / (2 * q)
    let cosw = cos(w0)
    let a0 = 1 + alpha / a
    return Biquad(
      b0: Float((1 + alpha * a) / a0), b1: Float(-2 * cosw / a0), b2: Float((1 - alpha * a) / a0),
      a1: Float(-2 * cosw / a0), a2: Float((1 - alpha / a) / a0)
    )
  }

  static func lowShelf(frequency: Double, gainDb: Double, sampleRate: Double) -> Biquad {
    let a = pow(10, gainDb / 40)
    let w0 = 2 * Double.pi * frequency / sampleRate
    let cosw = cos(w0)
    let alpha = sin(w0) / 2 * sqrt(2) // shelf slope 1
    let sqrtA2alpha = 2 * sqrt(a) * alpha
    let a0 = (a + 1) + (a - 1) * cosw + sqrtA2alpha
    return Biquad(
      b0: Float(a * ((a + 1) - (a - 1) * cosw + sqrtA2alpha) / a0),
      b1: Float(2 * a * ((a - 1) - (a + 1) * cosw) / a0),
      b2: Float(a * ((a + 1) - (a - 1) * cosw - sqrtA2alpha) / a0),
      a1: Float(-2 * ((a - 1) + (a + 1) * cosw) / a0),
      a2: Float(((a + 1) + (a - 1) * cosw - sqrtA2alpha) / a0)
    )
  }

  /// Same coefficients, keeping this filter's running state (so changes don't click).
  mutating func adopt(_ other: Biquad) {
    b0 = other.b0; b1 = other.b1; b2 = other.b2; a1 = other.a1; a2 = other.a2
  }

  @inline(__always)
  mutating func process(_ x: Float) -> Float {
    let y = b0 * x + z1
    z1 = b1 * x - a1 * y + z2
    z2 = b2 * x - a2 * y
    return y
  }
}

/**
 * The equalizer, bass boost, overall gain and volume levelling, applied to whatever AVPlayer is
 * playing through an audio processing tap. Settings change from the main thread; the tap reads a
 * snapshot on the audio thread (guarded by an unfair lock, never blocking: it keeps the previous
 * settings if the lock is busy).
 */
final class AudioEffects {
  static let shared = AudioEffects()

  static let bandFrequencies: [Double] = [31, 62, 125, 250, 500, 1000, 2000, 4000, 8000, 16000]
  static let bandQ = 1.1

  private var lock = os_unfair_lock()
  private var settings = EffectsSettings()
  private var version = 0

  func update(_ new: EffectsSettings) {
    os_unfair_lock_lock(&lock)
    settings = new
    version += 1
    os_unfair_lock_unlock(&lock)
  }

  /// Latest settings for the audio thread; nil when another thread is writing right now.
  fileprivate func trySnapshot() -> (EffectsSettings, Int)? {
    guard os_unfair_lock_trylock(&lock) else { return nil }
    defer { os_unfair_lock_unlock(&lock) }
    return (settings, version)
  }

  /// An audio mix that routes this asset's sound through the effects, or nil if it has no audio track.
  func audioMix(for asset: AVAsset, trackGainDb: Double, albumGainDb: Double) -> AVAudioMix? {
    // Local files load their tracks instantly; the synchronous API lets the mix be ready before play.
    guard let track = asset.tracks(withMediaType: .audio).first else { return nil }
    let context = TapContext(effects: self, trackGainDb: trackGainDb, albumGainDb: albumGainDb)

    var callbacks = MTAudioProcessingTapCallbacks(
      version: kMTAudioProcessingTapCallbacksVersion_0,
      clientInfo: Unmanaged.passRetained(context).toOpaque(),
      init: tapInit,
      finalize: tapFinalize,
      prepare: tapPrepare,
      unprepare: nil,
      process: tapProcess
    )
    var tap: MTAudioProcessingTap?
    guard MTAudioProcessingTapCreate(kCFAllocatorDefault, &callbacks, kMTAudioProcessingTapCreationFlag_PostEffects, &tap) == noErr,
          let tap
    else {
      Unmanaged<TapContext>.fromOpaque(callbacks.clientInfo!).release()
      return nil
    }
    let parameters = AVMutableAudioMixInputParameters(track: track)
    parameters.audioTapProcessor = tap
    let mix = AVMutableAudioMix()
    mix.inputParameters = [parameters]
    return mix
  }
}

/// Per-song processing state: filters for each channel and the song's levelling gains.
private final class TapContext {
  let effects: AudioEffects
  let trackGainDb: Double
  let albumGainDb: Double

  var sampleRate: Double = 44_100
  var isFloat = false
  var interleaved = false
  var channels = 2
  var appliedVersion = -1
  var enabled = false
  var linearGain: Float = 1
  /// [channel][filter]: bass shelf, then the 10 bands.
  var filters: [[Biquad]] = []

  init(effects: AudioEffects, trackGainDb: Double, albumGainDb: Double) {
    self.effects = effects
    self.trackGainDb = trackGainDb
    self.albumGainDb = albumGainDb
  }

  func prepare(format: AudioStreamBasicDescription) {
    sampleRate = format.mSampleRate > 0 ? format.mSampleRate : 44_100
    isFloat = format.mFormatFlags & kAudioFormatFlagIsFloat != 0 && format.mBitsPerChannel == 32
    interleaved = format.mFormatFlags & kAudioFormatFlagIsNonInterleaved == 0
    channels = max(1, Int(format.mChannelsPerFrame))
    appliedVersion = -1
    filters = Array(repeating: Array(repeating: Biquad.bypass, count: 11), count: channels)
  }

  private func apply(_ settings: EffectsSettings) {
    let levelling = settings.replayGain == "track" ? trackGainDb : settings.replayGain == "album" ? albumGainDb : 0
    let gainDb = (settings.enabled ? settings.preampDb : 0) + levelling
    linearGain = Float(pow(10, gainDb / 20))
    enabled = settings.enabled || levelling != 0

    var designs: [Biquad] = [
      settings.enabled && abs(settings.bassDb) > 0.05
        ? Biquad.lowShelf(frequency: 100, gainDb: settings.bassDb, sampleRate: sampleRate)
        : Biquad.bypass,
    ]
    for (i, frequency) in AudioEffects.bandFrequencies.enumerated() {
      let db = settings.enabled && i < settings.bandsDb.count ? settings.bandsDb[i] : 0
      designs.append(abs(db) > 0.05 ? Biquad.peaking(frequency: frequency, gainDb: db, q: AudioEffects.bandQ, sampleRate: sampleRate) : Biquad.bypass)
    }
    for channel in filters.indices {
      for f in filters[channel].indices {
        filters[channel][f].adopt(designs[f])
      }
    }
  }

  @inline(__always)
  private func processSample(_ x: Float, channel: Int) -> Float {
    var y = x * linearGain
    for f in 0..<filters[channel].count where filters[channel][f].b0 != 1 || filters[channel][f].a1 != 0 {
      y = filters[channel][f].process(y)
    }
    // Last-resort safety: never send samples beyond full scale to the output.
    return min(1, max(-1, y))
  }

  func process(_ list: UnsafeMutablePointer<AudioBufferList>, frames: Int) {
    if let (settings, version) = effects.trySnapshot(), version != appliedVersion {
      apply(settings)
      appliedVersion = version
    }
    guard enabled, isFloat, frames > 0 else { return }

    let buffers = UnsafeMutableAudioBufferListPointer(list)
    if interleaved {
      guard let buffer = buffers.first, let data = buffer.mData?.assumingMemoryBound(to: Float.self) else { return }
      let count = min(frames * channels, Int(buffer.mDataByteSize) / MemoryLayout<Float>.size)
      for i in 0..<count {
        data[i] = processSample(data[i], channel: i % channels)
      }
    } else {
      for (channel, buffer) in buffers.enumerated() where channel < channels {
        guard let data = buffer.mData?.assumingMemoryBound(to: Float.self) else { continue }
        let count = min(frames, Int(buffer.mDataByteSize) / MemoryLayout<Float>.size)
        for i in 0..<count {
          data[i] = processSample(data[i], channel: channel)
        }
      }
    }
  }
}

// MARK: Tap callbacks (C functions: no captures; the context travels as the tap's storage)

private let tapInit: MTAudioProcessingTapInitCallback = { _, clientInfo, tapStorageOut in
  tapStorageOut.pointee = clientInfo
}

private let tapFinalize: MTAudioProcessingTapFinalizeCallback = { tap in
  Unmanaged<TapContext>.fromOpaque(MTAudioProcessingTapGetStorage(tap)).release()
}

private let tapPrepare: MTAudioProcessingTapPrepareCallback = { tap, _, processingFormat in
  Unmanaged<TapContext>.fromOpaque(MTAudioProcessingTapGetStorage(tap)).takeUnretainedValue()
    .prepare(format: processingFormat.pointee)
}

private let tapProcess: MTAudioProcessingTapProcessCallback = { tap, numberFrames, _, bufferListInOut, numberFramesOut, flagsOut in
  let status = MTAudioProcessingTapGetSourceAudio(tap, numberFrames, bufferListInOut, flagsOut, nil, numberFramesOut)
  guard status == noErr else { return }
  Unmanaged<TapContext>.fromOpaque(MTAudioProcessingTapGetStorage(tap)).takeUnretainedValue()
    .process(bufferListInOut, frames: Int(numberFramesOut.pointee))
}
