package app.isai.library

import android.content.Context
import android.net.Uri
import java.io.InputStream
import java.nio.charset.Charset

/**
 * Reads ReplayGain tags, which Android's media database doesn't store:
 * - MP3: ID3v2 TXXX frames ("REPLAYGAIN_TRACK_GAIN" = "-6.54 dB", …)
 * - FLAC: Vorbis comments (REPLAYGAIN_TRACK_GAIN=-6.54 dB, …)
 * Only the start of the file is read (tags live there). Anything else returns no values.
 */
internal object ReplayGainReader {
  private const val MAX_HEADER_BYTES = 1 shl 20 // 1 MB: enough for tags plus large embedded art

  fun read(context: Context, uri: String): Map<String, Any?> {
    val values = mutableMapOf<String, Double>()
    try {
      context.contentResolver.openInputStream(Uri.parse(uri))?.use { stream ->
        val head = readUpTo(stream, MAX_HEADER_BYTES)
        when {
          head.size >= 10 && head[0] == 'I'.code.toByte() && head[1] == 'D'.code.toByte() && head[2] == '3'.code.toByte() ->
            parseId3(head, values)
          head.size >= 4 && String(head, 0, 4, Charsets.ISO_8859_1) == "fLaC" -> parseFlac(head, values)
        }
      }
    } catch (e: Exception) {
      // Unreadable file: no levelling for it.
    }
    return mapOf(
      "uri" to uri,
      "trackGain" to values["replaygain_track_gain"],
      "trackPeak" to values["replaygain_track_peak"],
      "albumGain" to values["replaygain_album_gain"],
      "albumPeak" to values["replaygain_album_peak"],
    )
  }

  private fun readUpTo(stream: InputStream, limit: Int): ByteArray {
    val buffer = ByteArray(limit)
    var total = 0
    while (total < limit) {
      val read = stream.read(buffer, total, limit - total)
      if (read <= 0) break
      total += read
    }
    return buffer.copyOf(total)
  }

  private fun store(name: String, value: String, into: MutableMap<String, Double>) {
    val key = name.trim().lowercase()
    if (!key.startsWith("replaygain_") || into.containsKey(key)) return
    val number = value.trim().split(" ").firstOrNull()?.toDoubleOrNull() ?: return
    if (number.isFinite() && kotlin.math.abs(number) < 60) into[key] = number
  }

  // ─── ID3v2 ──────────────────────────────────────────────────────────────────

  private fun synchsafe(b: ByteArray, at: Int): Int =
    ((b[at].toInt() and 0x7F) shl 21) or ((b[at + 1].toInt() and 0x7F) shl 14) or
      ((b[at + 2].toInt() and 0x7F) shl 7) or (b[at + 3].toInt() and 0x7F)

  private fun bigEndian(b: ByteArray, at: Int): Int =
    ((b[at].toInt() and 0xFF) shl 24) or ((b[at + 1].toInt() and 0xFF) shl 16) or
      ((b[at + 2].toInt() and 0xFF) shl 8) or (b[at + 3].toInt() and 0xFF)

  private fun parseId3(b: ByteArray, into: MutableMap<String, Double>) {
    val version = b[3].toInt()
    if (version < 3) return // ID3v2.2 uses 3-letter frames; ReplayGain in it is very rare
    val flags = b[5].toInt()
    val tagEnd = minOf(b.size, 10 + synchsafe(b, 6))
    var pos = 10
    if (flags and 0x40 != 0 && pos + 4 <= tagEnd) {
      // Extended header: skip it.
      pos += if (version >= 4) synchsafe(b, pos) else bigEndian(b, pos) + 4
    }
    while (pos + 10 <= tagEnd) {
      val id = String(b, pos, 4, Charsets.ISO_8859_1)
      if (id[0] == '\u0000') break // padding
      val size = if (version >= 4) synchsafe(b, pos + 4) else bigEndian(b, pos + 4)
      val dataStart = pos + 10
      if (size <= 0 || dataStart + size > tagEnd) break
      if (id == "TXXX") parseTxxx(b, dataStart, size, into)
      pos = dataStart + size
    }
  }

  private fun parseTxxx(b: ByteArray, start: Int, size: Int, into: MutableMap<String, Double>) {
    val encoding = b[start].toInt()
    val charset: Charset = when (encoding) {
      1 -> Charsets.UTF_16
      2 -> Charsets.UTF_16BE
      3 -> Charsets.UTF_8
      else -> Charsets.ISO_8859_1
    }
    // UTF-16 text ends with 00 00 (on a 2-byte boundary); other encodings with a single 0.
    val step = if (encoding == 1 || encoding == 2) 2 else 1
    val end = start + size
    var i = start + 1
    while (i + step <= end) {
      val isTerminator = if (step == 2) b[i] == 0.toByte() && b[i + 1] == 0.toByte() else b[i] == 0.toByte()
      if (isTerminator) break
      i += step
    }
    if (i + step > end) return
    val description = String(b, start + 1, i - start - 1, charset)
    val valueStart = i + step
    if (valueStart >= end) return
    val value = String(b, valueStart, end - valueStart, charset).trimEnd('\u0000')
    store(description, value, into)
  }

  // ─── FLAC ───────────────────────────────────────────────────────────────────

  private fun littleEndian(b: ByteArray, at: Int): Int =
    (b[at].toInt() and 0xFF) or ((b[at + 1].toInt() and 0xFF) shl 8) or
      ((b[at + 2].toInt() and 0xFF) shl 16) or ((b[at + 3].toInt() and 0xFF) shl 24)

  private fun parseFlac(b: ByteArray, into: MutableMap<String, Double>) {
    var pos = 4
    while (pos + 4 <= b.size) {
      val header = b[pos].toInt() and 0xFF
      val last = header and 0x80 != 0
      val type = header and 0x7F
      val length = ((b[pos + 1].toInt() and 0xFF) shl 16) or ((b[pos + 2].toInt() and 0xFF) shl 8) or (b[pos + 3].toInt() and 0xFF)
      val start = pos + 4
      if (start + length > b.size) return
      if (type == 4) {
        parseVorbisComments(b, start, start + length, into)
        return
      }
      if (last) return
      pos = start + length
    }
  }

  private fun parseVorbisComments(b: ByteArray, start: Int, end: Int, into: MutableMap<String, Double>) {
    var pos = start
    if (pos + 4 > end) return
    pos += 4 + littleEndian(b, pos) // vendor string
    if (pos + 4 > end) return
    val count = littleEndian(b, pos)
    pos += 4
    repeat(count) {
      if (pos + 4 > end) return
      val length = littleEndian(b, pos)
      pos += 4
      if (length < 0 || pos + length > end) return
      val comment = String(b, pos, length, Charsets.UTF_8)
      pos += length
      val eq = comment.indexOf('=')
      if (eq > 0) store(comment.substring(0, eq), comment.substring(eq + 1), into)
    }
  }
}
