package app.isai.library

import android.Manifest
import android.content.ContentResolver
import android.content.ContentUris
import android.content.Context
import android.database.Cursor
import android.os.Build
import android.os.Bundle
import android.provider.MediaStore
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Android side of the Isai music library: reads the system MediaStore index.
 *
 * Paging is keyset-based (`_ID > afterId`), so JS pulls one page at a time and can stop
 * between pages. Nothing here writes to the app database; JS owns all writes.
 */
class IsaiLibraryModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  private val audioPermission: String
    get() = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      Manifest.permission.READ_MEDIA_AUDIO
    } else {
      Manifest.permission.READ_EXTERNAL_STORAGE
    }

  override fun definition() = ModuleDefinition {
    Name("IsaiLibrary")

    AsyncFunction("getPermissionsAsync") { promise: Promise ->
      Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, audioPermission)
    }

    AsyncFunction("requestPermissionsAsync") { promise: Promise ->
      Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, audioPermission)
    }

    /** Changes when MediaStore was rebuilt (e.g. factory reset, new volume); forces a full rescan. */
    Function("getMediaStoreVersion") {
      MediaStore.getVersion(context)
    }

    AsyncFunction("queryAudio") { afterId: Long, limit: Int, minDurationMs: Int ->
      queryAudio(afterId, limit, minDurationMs)
    }

    /** Saves a square thumbnail of the file's artwork; null when the file has none. */
    AsyncFunction("getArtwork") { uri: String, key: String, size: Int ->
      ArtworkExtractor.extract(context, android.net.Uri.parse(uri), key, size)
    }

    /** Named colors of a local image (file:// or content:// URI); null when it can't be read. */
    AsyncFunction("getImageColors") { uri: String ->
      ArtworkExtractor.imageColors(context, android.net.Uri.parse(uri))
    }
  }

  private fun projection(): Array<String> {
    val columns = mutableListOf(
      MediaStore.Audio.Media._ID,
      MediaStore.Audio.Media.TITLE,
      MediaStore.Audio.Media.ARTIST,
      MediaStore.Audio.Media.ALBUM,
      MediaStore.Audio.Media.YEAR,
      MediaStore.Audio.Media.TRACK,
      MediaStore.Audio.Media.DURATION,
      MediaStore.Audio.Media.SIZE,
      MediaStore.Audio.Media.MIME_TYPE,
      MediaStore.Audio.Media.DATE_ADDED,
      MediaStore.Audio.Media.DATE_MODIFIED,
      MediaStore.Audio.Media.DISPLAY_NAME,
      MediaStore.Audio.Media.RELATIVE_PATH,
      MediaStore.Audio.Media.VOLUME_NAME,
      MediaStore.Audio.Media.COMPOSER,
    )
    // These columns only exist from Android 11; querying them earlier throws.
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      columns += listOf(
        MediaStore.Audio.Media.ALBUM_ARTIST,
        MediaStore.Audio.Media.GENRE,
        MediaStore.Audio.Media.BITRATE,
        MediaStore.Audio.Media.DISC_NUMBER,
      )
    }
    return columns.toTypedArray()
  }

  private fun queryAudio(afterId: Long, limit: Int, minDurationMs: Int): List<Map<String, Any?>> {
    val selection = "${MediaStore.Audio.Media._ID} > ? AND " +
      "${MediaStore.Audio.Media.IS_MUSIC} != 0 AND " +
      "${MediaStore.Audio.Media.DURATION} >= ?"
    val args = Bundle().apply {
      putString(ContentResolver.QUERY_ARG_SQL_SELECTION, selection)
      putStringArray(
        ContentResolver.QUERY_ARG_SQL_SELECTION_ARGS,
        arrayOf(afterId.toString(), minDurationMs.toString()),
      )
      putString(ContentResolver.QUERY_ARG_SQL_SORT_ORDER, "${MediaStore.Audio.Media._ID} ASC")
      // Honored from Android 11; on Android 10 the loop below still stops at `limit`.
      putInt(ContentResolver.QUERY_ARG_LIMIT, limit)
    }

    val uri = MediaStore.Audio.Media.EXTERNAL_CONTENT_URI
    val rows = ArrayList<Map<String, Any?>>(limit)
    context.contentResolver.query(uri, projection(), args, null)?.use { cursor ->
      while (rows.size < limit && cursor.moveToNext()) {
        rows += readRow(cursor, uri)
      }
    }
    return rows
  }

  private fun readRow(c: Cursor, baseUri: android.net.Uri): Map<String, Any?> {
    val id = c.long(MediaStore.Audio.Media._ID) ?: 0L

    // TRACK packs the disc into the thousands: 2003 = disc 2, track 3.
    val packedTrack = c.int(MediaStore.Audio.Media.TRACK)
    val track = packedTrack?.let { if (it >= 1000) it % 1000 else it }?.takeIf { it > 0 }
    var disc = packedTrack?.let { if (it >= 1000) it / 1000 else null }
    c.string(MediaStore.Audio.Media.DISC_NUMBER)?.let { raw ->
      raw.substringBefore('/').trim().toIntOrNull()?.takeIf { it > 0 }?.let { disc = it }
    }

    return mapOf(
      "id" to id.toString(),
      "uri" to ContentUris.withAppendedId(baseUri, id).toString(),
      "title" to c.tag(MediaStore.Audio.Media.TITLE),
      "artist" to c.tag(MediaStore.Audio.Media.ARTIST),
      "album" to c.tag(MediaStore.Audio.Media.ALBUM),
      "albumArtist" to c.tag(MediaStore.Audio.Media.ALBUM_ARTIST),
      "genre" to c.tag(MediaStore.Audio.Media.GENRE),
      "year" to c.int(MediaStore.Audio.Media.YEAR)?.takeIf { it > 0 },
      "trackNo" to track,
      "discNo" to disc,
      "durationMs" to (c.long(MediaStore.Audio.Media.DURATION) ?: 0L),
      "fileSize" to (c.long(MediaStore.Audio.Media.SIZE) ?: 0L),
      "mime" to c.string(MediaStore.Audio.Media.MIME_TYPE),
      // MediaStore stores seconds; JS works in milliseconds.
      "dateAdded" to (c.long(MediaStore.Audio.Media.DATE_ADDED) ?: 0L) * 1000,
      "dateModified" to (c.long(MediaStore.Audio.Media.DATE_MODIFIED) ?: 0L) * 1000,
      "fileName" to (c.string(MediaStore.Audio.Media.DISPLAY_NAME) ?: "$id"),
      "relativePath" to c.string(MediaStore.Audio.Media.RELATIVE_PATH),
      "volume" to c.string(MediaStore.Audio.Media.VOLUME_NAME),
      "bitrate" to c.int(MediaStore.Audio.Media.BITRATE)?.takeIf { it > 0 },
      "composer" to c.tag(MediaStore.Audio.Media.COMPOSER),
    )
  }
}

private fun Cursor.index(column: String): Int? = getColumnIndex(column).takeIf { it >= 0 }

private fun Cursor.string(column: String): String? =
  index(column)?.let { if (isNull(it)) null else getString(it) }

private fun Cursor.long(column: String): Long? =
  index(column)?.let { if (isNull(it)) null else getLong(it) }

private fun Cursor.int(column: String): Int? =
  index(column)?.let { if (isNull(it)) null else getInt(it) }

/** Tag text with MediaStore's "<unknown>" placeholder and blanks treated as missing. */
private fun Cursor.tag(column: String): String? =
  string(column)?.trim()?.takeIf { it.isNotEmpty() && it != MediaStore.UNKNOWN_STRING }
