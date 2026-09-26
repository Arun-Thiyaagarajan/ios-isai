import AVFoundation

/// Tags for one file. Missing values stay nil; JS falls back to the file name.
struct TrackTags: Sendable {
  var path: String
  var readable = false
  var title: String?
  var artist: String?
  var album: String?
  var albumArtist: String?
  var genre: String?
  var year: Int?
  var trackNo: Int?
  var discNo: Int?
  var durationMs: Int = 0
  var hasArt = false

  var dictionary: [String: Any] {
    var d: [String: Any] = ["path": path, "readable": readable, "durationMs": durationMs, "hasArt": hasArt]
    d["title"] = title
    d["artist"] = artist
    d["album"] = album
    d["albumArtist"] = albumArtist
    d["genre"] = genre
    d["year"] = year
    d["trackNo"] = trackNo
    d["discNo"] = discNo
    return d
  }
}

/**
 * Reads tags with AVFoundation (ID3, iTunes/MP4 atoms and common metadata).
 * Formats AVFoundation can't open (Ogg Vorbis, Opus, WMA) come back with `readable: false`;
 * the audio-engine module adds a decoder library that covers them.
 */
enum TagReader {
  private static let maxConcurrent = 4

  static func read(base: URL, paths: [String]) async -> [TrackTags] {
    var results = [TrackTags?](repeating: nil, count: paths.count)
    await withTaskGroup(of: (Int, TrackTags).self) { group in
      var next = 0
      var inFlight = 0
      while next < paths.count || inFlight > 0 {
        // Keep at most `maxConcurrent` files open at once.
        while next < paths.count && inFlight < maxConcurrent {
          let index = next
          let url = base.appendingPathComponent(paths[index])
          let path = paths[index]
          group.addTask { (index, await readOne(url: url, path: path)) }
          next += 1
          inFlight += 1
        }
        if let finished = await group.next() {
          results[finished.0] = finished.1
          inFlight -= 1
        }
      }
    }
    return results.compactMap { $0 }
  }

  private static func readOne(url: URL, path: String) async -> TrackTags {
    var tags = TrackTags(path: path)
    let asset = AVURLAsset(url: url)
    guard let loaded = try? await asset.load(.duration, .metadata) else {
      return tags
    }
    let (duration, items) = loaded
    tags.readable = true
    if duration.isNumeric {
      tags.durationMs = Int((duration.seconds * 1000).rounded())
    }

    // First value wins for each field (common/ID3/iTunes keys often repeat the same tag).
    for item in items {
      guard let id = item.identifier else { continue }
      switch id {
      case .commonIdentifierTitle, .id3MetadataTitleDescription, .iTunesMetadataSongName:
        if tags.title == nil { tags.title = await text(item) }
      case .commonIdentifierArtist, .id3MetadataLeadPerformer, .iTunesMetadataArtist:
        if tags.artist == nil { tags.artist = await text(item) }
      case .commonIdentifierAlbumName, .id3MetadataAlbumTitle, .iTunesMetadataAlbum:
        if tags.album == nil { tags.album = await text(item) }
      case .id3MetadataBand, .iTunesMetadataAlbumArtist:
        if tags.albumArtist == nil { tags.albumArtist = await text(item) }
      case .id3MetadataContentType, .iTunesMetadataUserGenre, .commonIdentifierType:
        if tags.genre == nil { tags.genre = await text(item).flatMap(cleanGenre) }
      case .id3MetadataYear, .id3MetadataRecordingTime, .iTunesMetadataReleaseDate, .commonIdentifierCreationDate:
        if tags.year == nil { tags.year = await text(item).flatMap(parseYear) }
      case .id3MetadataTrackNumber:
        if tags.trackNo == nil { tags.trackNo = await text(item).flatMap(leadingNumber) }
      case .id3MetadataPartOfASet:
        if tags.discNo == nil { tags.discNo = await text(item).flatMap(leadingNumber) }
      case .iTunesMetadataTrackNumber:
        if tags.trackNo == nil { tags.trackNo = await packedNumber(item) }
      case .iTunesMetadataDiscNumber:
        if tags.discNo == nil { tags.discNo = await packedNumber(item) }
      case .commonIdentifierArtwork, .id3MetadataAttachedPicture, .iTunesMetadataCoverArt:
        tags.hasArt = true
      default:
        break
      }
    }
    return tags
  }

  private static func text(_ item: AVMetadataItem) async -> String? {
    if let value = try? await item.load(.stringValue) {
      let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
      return trimmed.isEmpty ? nil : trimmed
    }
    if let number = try? await item.load(.numberValue) {
      return number.stringValue
    }
    return nil
  }

  /// MP4 "trkn"/"disk" atoms: big-endian UInt16 number at bytes 2–3.
  private static func packedNumber(_ item: AVMetadataItem) async -> Int? {
    if let data = try? await item.load(.dataValue), data.count >= 4 {
      let value = Int(data[data.startIndex + 2]) << 8 | Int(data[data.startIndex + 3])
      return value > 0 ? value : nil
    }
    return await text(item).flatMap(leadingNumber)
  }

  /// "3/12" → 3
  private static func leadingNumber(_ text: String) -> Int? {
    let digits = text.prefix { $0.isNumber }
    guard let value = Int(digits), value > 0 else { return nil }
    return value
  }

  /// "2019-05-01T00:00:00Z" or "2019" → 2019
  private static func parseYear(_ text: String) -> Int? {
    guard let value = Int(text.prefix(4)), (1000...9999).contains(value) else { return nil }
    return value
  }

  /// ID3v1-style "(17)" genre references are dropped; real names pass through.
  private static func cleanGenre(_ text: String) -> String? {
    text.range(of: #"^\(\d+\)$"#, options: .regularExpression) == nil ? text : nil
  }
}
