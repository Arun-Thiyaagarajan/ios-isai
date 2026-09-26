package app.isai.audio

import android.content.Context
import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.Player
import androidx.media3.common.audio.AudioProcessor
import androidx.media3.exoplayer.DefaultRenderersFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.audio.AudioSink
import androidx.media3.exoplayer.audio.DefaultAudioSink
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Owns the player while music plays, so playback continues with the app in the background.
 * Media3 turns the session into the notification, lock-screen controls and Bluetooth/headset
 * button handling, and manages audio focus (calls, other apps) and headphone unplugging.
 */
@UnstableApi
class PlaybackService : MediaSessionService() {
  private var session: MediaSession? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
    // Standard media notification, or a plain one when the lock screen player is turned off.
    setMediaNotificationProvider(LockScreenNotificationProvider(this))
    // Decoded audio passes through the equalizer / levelling processor before the speaker.
    val renderers = object : DefaultRenderersFactory(this) {
      override fun buildAudioSink(
        context: Context,
        enableFloatOutput: Boolean,
        enableAudioOutputPlaybackParams: Boolean,
      ): AudioSink =
        DefaultAudioSink.Builder(context)
          .setAudioProcessors(arrayOf<AudioProcessor>(EqualizerProcessor()))
          .setEnableFloatOutput(enableFloatOutput)
          .setEnableAudioOutputPlaybackParameters(enableAudioOutputPlaybackParams)
          .build()
    }
    val player = ExoPlayer.Builder(this, renderers)
      .setAudioAttributes(
        AudioAttributes.Builder()
          .setUsage(C.USAGE_MEDIA)
          .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
          .build(),
        /* handleAudioFocus = */ true,
      )
      .setHandleAudioBecomingNoisy(true)
      .setWakeMode(C.WAKE_MODE_LOCAL)
      .build()
    // Each song's levelling gains travel in its media item; hand them to the processor as it starts.
    player.addListener(object : Player.Listener {
      override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
        val extras = mediaItem?.mediaMetadata?.extras
        AudioEffects.setSongGains(extras?.getDouble(EXTRA_TRACK_GAIN) ?: 0.0, extras?.getDouble(EXTRA_ALBUM_GAIN) ?: 0.0)
      }
    })
    session = MediaSession.Builder(this, player)
      .setCallback(SessionCallback())
      .build()
  }

  override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? = session

  /** Swiping the app away stops the service only when nothing is playing. */
  override fun onTaskRemoved(rootIntent: Intent?) {
    val player = session?.player
    if (player == null || !player.playWhenReady || player.mediaItemCount == 0) {
      stopSelf()
    }
  }

  /** Rebuilds the notification after the lock screen setting changed. */
  fun refreshNotification() {
    session?.let { triggerNotificationUpdate() }
  }

  override fun onDestroy() {
    instance = null
    session?.run {
      player.release()
      release()
    }
    session = null
    super.onDestroy()
  }

  companion object {
    const val EXTRA_TRACK_GAIN = "isai.trackGainDb"
    const val EXTRA_ALBUM_GAIN = "isai.albumGainDb"

    /** The running service, if any (the module uses it to refresh the notification). */
    @Volatile
    var instance: PlaybackService? = null
      private set
  }

  private class SessionCallback : MediaSession.Callback {
    /**
     * Items sent from a controller arrive without their playback URI (Media3 strips it for
     * security); the URI travels in the request metadata and is restored here.
     */
    override fun onAddMediaItems(
      mediaSession: MediaSession,
      controller: MediaSession.ControllerInfo,
      mediaItems: MutableList<MediaItem>,
    ): ListenableFuture<MutableList<MediaItem>> =
      Futures.immediateFuture(
        mediaItems.map { item ->
          item.requestMetadata.mediaUri?.let { item.buildUpon().setUri(it).build() } ?: item
        }.toMutableList(),
      )
  }
}
