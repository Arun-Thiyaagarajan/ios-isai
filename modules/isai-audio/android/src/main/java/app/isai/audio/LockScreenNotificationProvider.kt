package app.isai.audio

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Bundle
import androidx.core.app.NotificationCompat
import androidx.media3.common.util.UnstableApi
import androidx.media3.session.CommandButton
import androidx.media3.session.DefaultMediaNotificationProvider
import androidx.media3.session.MediaNotification
import androidx.media3.session.MediaSession
import com.google.common.collect.ImmutableList

/**
 * "Show player on lock screen" for Android.
 *
 * On: Media3's standard media notification (artwork, controls, seek bar, lock screen, quick settings).
 * Off: Android still requires a notification while music plays in the background, so a plain,
 * silent one is shown instead: no controls, and hidden on the lock screen. Playback is unaffected.
 */
@UnstableApi
class LockScreenNotificationProvider(private val context: Context) : MediaNotification.Provider {
  private val standard = DefaultMediaNotificationProvider.Builder(context).build()

  override fun createNotification(
    mediaSession: MediaSession,
    mediaButtonPreferences: ImmutableList<CommandButton>,
    actionFactory: MediaNotification.ActionFactory,
    onNotificationChangedCallback: MediaNotification.Provider.Callback,
  ): MediaNotification {
    if (LockScreenSetting.isEnabled(context)) {
      return standard.createNotification(mediaSession, mediaButtonPreferences, actionFactory, onNotificationChangedCallback)
    }
    ensureChannel()
    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(androidx.media3.session.R.drawable.media3_notification_small_icon)
      .setContentTitle("Isai")
      .setContentText("Playing music")
      .setContentIntent(mediaSession.sessionActivity)
      .setVisibility(NotificationCompat.VISIBILITY_SECRET)
      .setPriority(NotificationCompat.PRIORITY_LOW)
      .setSilent(true)
      .setOngoing(true)
      .build()
    return MediaNotification(NOTIFICATION_ID, notification)
  }

  override fun handleCustomCommand(session: MediaSession, action: String, extras: Bundle): Boolean =
    standard.handleCustomCommand(session, action, extras)

  private fun ensureChannel() {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(CHANNEL_ID, "Playback", NotificationManager.IMPORTANCE_LOW).apply {
        description = "Shown while music plays, when the lock screen player is turned off"
        lockscreenVisibility = NotificationCompat.VISIBILITY_SECRET
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }
  }

  private companion object {
    const val CHANNEL_ID = "isai_playback_plain"
    // Same id as Media3's default notification, so switching replaces it instead of adding one.
    const val NOTIFICATION_ID = DefaultMediaNotificationProvider.DEFAULT_NOTIFICATION_ID
  }
}

/** The lock screen player setting, saved natively so it applies even before the app's UI starts. */
object LockScreenSetting {
  private const val PREFS = "isai_audio"
  private const val KEY = "lock_screen_controls"

  fun isEnabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY, true)

  fun setEnabled(context: Context, enabled: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY, enabled).apply()
  }
}
