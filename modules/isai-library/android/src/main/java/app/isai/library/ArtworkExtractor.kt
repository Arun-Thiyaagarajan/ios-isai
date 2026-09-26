package app.isai.library

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Color
import android.net.Uri
import android.util.Size
import androidx.palette.graphics.Palette
import java.io.File
import java.io.FileOutputStream
import java.io.IOException

/**
 * Album artwork thumbnails.
 *
 * MediaStore already knows how to pull embedded art (or a folder image) out of audio files,
 * so we ask it for a thumbnail, save a JPEG copy in the app cache and extract palette colors.
 */
internal object ArtworkExtractor {
  fun extract(context: Context, uri: Uri, key: String, size: Int): Map<String, Any?>? {
    val bitmap = try {
      context.contentResolver.loadThumbnail(uri, Size(size, size), null)
    } catch (e: IOException) {
      return null // no artwork in this file
    } catch (e: SecurityException) {
      return null
    }

    val dir = File(context.cacheDir, "artwork").apply { mkdirs() }
    val safeKey = key.replace(Regex("[^A-Za-z0-9_-]"), "_")
    // A new file name each time, so image caches never show an outdated cover.
    dir.listFiles { file -> file.name.startsWith("$safeKey-") }?.forEach { it.delete() }
    val file = File(dir, "$safeKey-${System.currentTimeMillis()}.jpg")
    FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 88, it) }

    val colors = colorsOf(bitmap)
    bitmap.recycle()
    return mapOf("uri" to Uri.fromFile(file).toString(), "colors" to colors)
  }

  private fun colorsOf(bitmap: Bitmap): Map<String, String> {
    val palette = Palette.from(bitmap).maximumColorCount(16).generate()
    val primary = palette.dominantSwatch?.rgb ?: Color.DKGRAY
    val secondary = (palette.vibrantSwatch ?: palette.mutedSwatch ?: palette.dominantSwatch)?.rgb ?: primary
    val on = if (luminance(primary) > 0.45) Color.BLACK else Color.WHITE
    return mapOf("primary" to hex(primary), "secondary" to hex(secondary), "on" to hex(on))
  }

  private fun luminance(color: Int): Double {
    fun channel(c: Int): Double {
      val s = c / 255.0
      return if (s <= 0.03928) s / 12.92 else Math.pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(Color.red(color)) + 0.7152 * channel(Color.green(color)) + 0.0722 * channel(Color.blue(color))
  }

  private fun hex(color: Int) = String.format("#%06X", 0xFFFFFF and color)
}
