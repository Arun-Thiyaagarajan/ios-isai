package app.isai.audio

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.database.ContentObserver
import android.media.AudioManager
import android.media.MediaRouter2
import android.os.Build
import android.provider.Settings
import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import com.google.common.util.concurrent.MoreExecutors
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

/** One queue entry as sent from JS. */
class QueueItemRecord : Record {
  @Field val key: String = ""
  @Field val uri: String? = null
  @Field val title: String = ""
  @Field val artist: String = ""
  @Field val album: String? = null
  @Field val artworkUri: String? = null
  @Field val durationMs: Double = 0.0
}

/**
 * Isai's playback engine on Android: a thin bridge to a Media3 MediaController connected to
 * [PlaybackService]. The queue order is decided in JS; this side plays, advances and reports.
 * All controller calls happen on the main thread, as Media3 requires.
 */
class IsaiAudioModule : Module() {
  private val context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val main = Handler(Looper.getMainLooper())
  private var controllerFuture: ListenableFuture<MediaController>? = null
  private var controller: MediaController? = null
  private val pending = mutableListOf<(MediaController) -> Unit>()

  // For play counts: which item was playing and how far it got.
  private var lastKey: String? = null
  private var lastPositionMs = 0L
  private var lastDurationMs = 0L
  private var consecutiveErrors = 0

  private val ticker = object : Runnable {
    override fun run() {
      controller?.let {
        rememberPosition(it)
        emitState(it)
      }
      main.postDelayed(this, TICK_MS)
    }
  }

  override fun definition() = ModuleDefinition {
    Name("IsaiAudio")
    Events("onPlaybackState", "onTransition", "onError", "onVolumeChange")

    OnCreate {
      main.post { connect() }
      // Volume changes from the hardware buttons or the system panel keep the slider in sync.
      runCatching { context.contentResolver.registerContentObserver(Settings.System.CONTENT_URI, true, volumeObserver) }
    }

    OnDestroy {
      runCatching { context.contentResolver.unregisterContentObserver(volumeObserver) }
      main.post {
        main.removeCallbacks(ticker)
        controller?.removeListener(listener)
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controller = null
      }
    }

    AsyncFunction("setQueue") { items: List<QueueItemRecord>, index: Int, positionMs: Double, play: Boolean ->
      withController { c ->
        consecutiveErrors = 0
        lastKey = null
        c.setMediaItems(items.map(::toMediaItem), index.coerceIn(0, maxOf(0, items.size - 1)), positionMs.toLong())
        c.prepare()
        c.playWhenReady = play
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("insert") { at: Int, items: List<QueueItemRecord> ->
      withController { c ->
        val wasEmpty = c.mediaItemCount == 0
        c.addMediaItems(at.coerceIn(0, c.mediaItemCount), items.map(::toMediaItem))
        if (wasEmpty) c.prepare()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("remove") { from: Int, to: Int ->
      withController { c ->
        if (from < to && from >= 0) c.removeMediaItems(from, minOf(to, c.mediaItemCount))
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("move") { from: Int, to: Int ->
      withController { c ->
        if (from in 0 until c.mediaItemCount && to in 0 until c.mediaItemCount) c.moveMediaItem(from, to)
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("play") {
      withController { c ->
        when (c.playbackState) {
          Player.STATE_IDLE -> c.prepare()
          Player.STATE_ENDED -> c.seekTo(c.currentMediaItemIndex, 0)
        }
        c.play()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("pause") { withController { it.pause() } }.runOnQueue(Queues.MAIN)

    AsyncFunction("seekTo") { positionMs: Double ->
      withController { it.seekTo(positionMs.toLong()) }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("skipToNext") {
      withController { c ->
        rememberPosition(c)
        if (c.hasNextMediaItem()) c.seekToNextMediaItem()
      }
    }.runOnQueue(Queues.MAIN)

    // Restarts the song after the first 3 seconds; otherwise goes to the previous one.
    AsyncFunction("skipToPrevious") {
      withController { c ->
        rememberPosition(c)
        c.seekToPrevious()
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("skipTo") { index: Int ->
      withController { c ->
        rememberPosition(c)
        if (index in 0 until c.mediaItemCount) {
          c.seekTo(index, 0)
          if (c.playbackState == Player.STATE_IDLE) c.prepare()
          c.play()
        }
      }
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("setRepeatMode") { mode: String ->
      withController {
        it.repeatMode = when (mode) {
          "one" -> Player.REPEAT_MODE_ONE
          "all" -> Player.REPEAT_MODE_ALL
          else -> Player.REPEAT_MODE_OFF
        }
      }
    }.runOnQueue(Queues.MAIN)

    // ─── Output ───────────────────────────────────────────────────────────────

    /** Media volume, 0…1. */
    Function("getVolume") { currentVolume() }

    AsyncFunction("setVolume") { volume: Double ->
      val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
      val index = Math.round(volume.coerceIn(0.0, 1.0) * max).toInt()
      // Can be refused (e.g. in Do Not Disturb); the slider then snaps back on the next update.
      runCatching { audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, index, 0) }
      lastVolume = currentVolume()
    }

    /**
     * Opens the system's output picker (speaker, Bluetooth, cast). Android 14+ has one for apps;
     * older versions get the Bluetooth settings instead. Returns false if nothing could be opened.
     */
    AsyncFunction("showOutputSwitcher") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE &&
        MediaRouter2.getInstance(context).showSystemOutputSwitcher()
      ) {
        return@AsyncFunction true
      }
      val intent = Intent(Settings.ACTION_BLUETOOTH_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      runCatching { context.startActivity(intent) }.isSuccess
    }.runOnQueue(Queues.MAIN)

    /** Shows or hides the lock screen / notification player. Playback itself is unaffected. */
    AsyncFunction("setLockScreenControls") { enabled: Boolean ->
      LockScreenSetting.setEnabled(context, enabled)
      PlaybackService.instance?.refreshNotification()
    }.runOnQueue(Queues.MAIN)

    AsyncFunction("getState") {
      val c = controller ?: return@AsyncFunction null
      state(c) + mapOf("keys" to (0 until c.mediaItemCount).map { c.getMediaItemAt(it).mediaId })
    }.runOnQueue(Queues.MAIN)
  }

  // ─── Volume ─────────────────────────────────────────────────────────────────

  private val audioManager
    get() = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

  private var lastVolume = -1.0

  private fun currentVolume(): Double {
    val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    return if (max > 0) audioManager.getStreamVolume(AudioManager.STREAM_MUSIC).toDouble() / max else 0.0
  }

  private val volumeObserver = object : ContentObserver(main) {
    override fun onChange(selfChange: Boolean) {
      val volume = runCatching { currentVolume() }.getOrNull() ?: return
      if (volume != lastVolume) {
        lastVolume = volume
        sendEvent("onVolumeChange", mapOf("volume" to volume))
      }
    }
  }

  // ─── Connection ─────────────────────────────────────────────────────────────

  private fun connect() {
    if (controllerFuture != null) return
    val token = SessionToken(context, ComponentName(context, PlaybackService::class.java))
    val future = MediaController.Builder(context, token).buildAsync()
    controllerFuture = future
    future.addListener({
      val c = try {
        future.get()
      } catch (e: Exception) {
        sendEvent("onError", mapOf("key" to null, "message" to "Couldn't start the player: ${e.message}"))
        controllerFuture = null
        return@addListener
      }
      controller = c
      c.addListener(listener)
      pending.forEach { it(c) }
      pending.clear()
      main.post(ticker)
      emitState(c)
    }, MoreExecutors.directExecutor())
  }

  private fun withController(action: (MediaController) -> Unit) {
    val c = controller
    if (c != null) {
      action(c)
    } else {
      pending += action
      connect()
    }
  }

  // ─── Events ─────────────────────────────────────────────────────────────────

  private val listener = object : Player.Listener {
    override fun onEvents(player: Player, events: Player.Events) {
      emitState(player)
    }

    override fun onMediaItemTransition(mediaItem: MediaItem?, reason: Int) {
      val c = controller ?: return
      val completed = reason == Player.MEDIA_ITEM_TRANSITION_REASON_AUTO ||
        reason == Player.MEDIA_ITEM_TRANSITION_REASON_REPEAT
      emitTransition(completed, mediaItem?.mediaId)
      lastKey = mediaItem?.mediaId
      lastPositionMs = 0
      lastDurationMs = c.duration.takeIf { it != C.TIME_UNSET } ?: 0
    }

    override fun onPlaybackStateChanged(playbackState: Int) {
      val c = controller ?: return
      if (playbackState == Player.STATE_READY) {
        consecutiveErrors = 0
        if (lastKey == null) lastKey = c.currentMediaItem?.mediaId
      }
      if (playbackState == Player.STATE_ENDED) {
        // The last song of the queue finished.
        emitTransition(completed = true, toKey = null)
        lastKey = null
      }
    }

    override fun onPlayerError(error: PlaybackException) {
      val c = controller ?: return
      sendEvent(
        "onError",
        mapOf("key" to c.currentMediaItem?.mediaId, "message" to (error.message ?: "Playback error")),
      )
      // Skip files that can't be played, but don't loop forever over a broken queue.
      consecutiveErrors += 1
      if (consecutiveErrors < MAX_CONSECUTIVE_ERRORS && c.hasNextMediaItem()) {
        lastKey = null
        c.seekToNextMediaItem()
        c.prepare()
        c.play()
      }
    }
  }

  private fun rememberPosition(c: Player) {
    if (c.currentMediaItem?.mediaId == lastKey) {
      lastPositionMs = c.currentPosition
      c.duration.takeIf { it != C.TIME_UNSET }?.let { lastDurationMs = it }
    }
  }

  private fun emitTransition(completed: Boolean, toKey: String?) {
    val from = lastKey ?: return
    sendEvent(
      "onTransition",
      mapOf(
        "fromKey" to from,
        "toKey" to toKey,
        "completed" to completed,
        "playedMs" to (if (completed) lastDurationMs else lastPositionMs).toDouble(),
        "durationMs" to lastDurationMs.toDouble(),
      ),
    )
  }

  private fun state(c: Player): Map<String, Any?> = mapOf(
    "index" to c.currentMediaItemIndex,
    "key" to c.currentMediaItem?.mediaId,
    "isPlaying" to c.isPlaying,
    "isBuffering" to (c.playbackState == Player.STATE_BUFFERING),
    "ended" to (c.playbackState == Player.STATE_ENDED),
    "positionMs" to c.currentPosition.toDouble(),
    "durationMs" to (c.duration.takeIf { it != C.TIME_UNSET } ?: 0L).toDouble(),
    "queueLength" to c.mediaItemCount,
    "repeat" to when (c.repeatMode) {
      Player.REPEAT_MODE_ONE -> "one"
      Player.REPEAT_MODE_ALL -> "all"
      else -> "off"
    },
    "timestamp" to System.currentTimeMillis().toDouble(),
  )

  private fun emitState(c: Player) {
    sendEvent("onPlaybackState", state(c))
  }

  private fun toMediaItem(item: QueueItemRecord): MediaItem {
    val uri = Uri.parse(item.uri ?: "")
    return MediaItem.Builder()
      .setMediaId(item.key)
      .setUri(uri)
      .setRequestMetadata(MediaItem.RequestMetadata.Builder().setMediaUri(uri).build())
      .setMediaMetadata(
        MediaMetadata.Builder()
          .setTitle(item.title)
          .setArtist(item.artist)
          .setAlbumTitle(item.album)
          .setArtworkUri(item.artworkUri?.let(Uri::parse))
          .setDurationMs(item.durationMs.toLong())
          .setIsPlayable(true)
          .setIsBrowsable(false)
          .build(),
      )
      .build()
  }

  private companion object {
    const val TICK_MS = 1000L
    const val MAX_CONSECUTIVE_ERRORS = 5
  }
}
