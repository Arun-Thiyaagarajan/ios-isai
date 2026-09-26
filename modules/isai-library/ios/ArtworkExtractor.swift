import AVFoundation
import UIKit

/**
 * Album artwork thumbnails on iOS: embedded art (ID3 APIC, MP4 covr) via AVFoundation,
 * falling back to a cover image next to the file (cover.jpg, folder.jpg, …).
 */
enum ArtworkExtractor {
  private static let sidecarNames = ["cover", "folder", "front", "album", "artwork"]
  private static let sidecarExtensions = ["jpg", "jpeg", "png"]

  static func extract(fileURL: URL, key: String, size: Int) async -> [String: Any]? {
    guard let data = await embeddedArtwork(fileURL) ?? sidecarArtwork(fileURL),
          let image = UIImage(data: data)
    else { return nil }

    let thumbnail = scaled(image, maxSide: CGFloat(size))
    guard let jpeg = thumbnail.jpegData(compressionQuality: 0.88) else { return nil }

    let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("artwork", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    let safeKey = key.replacingOccurrences(of: "[^A-Za-z0-9_-]", with: "_", options: .regularExpression)

    // A new file name each time, so image caches never show an outdated cover.
    if let old = try? FileManager.default.contentsOfDirectory(atPath: dir.path) {
      for name in old where name.hasPrefix("\(safeKey)-") {
        try? FileManager.default.removeItem(at: dir.appendingPathComponent(name))
      }
    }
    let file = dir.appendingPathComponent("\(safeKey)-\(Int(Date().timeIntervalSince1970 * 1000)).jpg")
    do {
      try jpeg.write(to: file, options: .atomic)
    } catch {
      return nil
    }
    return ["uri": file.absoluteString, "colors": colors(of: thumbnail), "palette": PaletteExtractor.palette(of: thumbnail)]
  }

  /// Named colors of an image file already on disk (a saved thumbnail or a custom cover).
  static func palette(ofImageAt url: URL) -> [String: String]? {
    guard let image = UIImage(contentsOfFile: url.path) else { return nil }
    return PaletteExtractor.palette(of: scaled(image, maxSide: 200))
  }

  private static func embeddedArtwork(_ url: URL) async -> Data? {
    let asset = AVURLAsset(url: url)
    guard let items = try? await asset.load(.metadata) else { return nil }
    for item in items {
      guard let id = item.identifier,
            id == .commonIdentifierArtwork || id == .id3MetadataAttachedPicture || id == .iTunesMetadataCoverArt
      else { continue }
      if let data = try? await item.load(.dataValue), !data.isEmpty {
        return data
      }
    }
    return nil
  }

  private static func sidecarArtwork(_ url: URL) -> Data? {
    let dir = url.deletingLastPathComponent()
    guard let names = try? FileManager.default.contentsOfDirectory(atPath: dir.path) else { return nil }
    for candidate in sidecarNames {
      if let match = names.first(where: { name in
        let lower = name.lowercased()
        return sidecarExtensions.contains { lower == "\(candidate).\($0)" }
      }) {
        return try? Data(contentsOf: dir.appendingPathComponent(match))
      }
    }
    return nil
  }

  private static func scaled(_ image: UIImage, maxSide: CGFloat) -> UIImage {
    let largest = max(image.size.width, image.size.height)
    guard largest > maxSide else { return image }
    let ratio = maxSide / largest
    let target = CGSize(width: image.size.width * ratio, height: image.size.height * ratio)
    let format = UIGraphicsImageRendererFormat()
    format.scale = 1
    return UIGraphicsImageRenderer(size: target, format: format).image { _ in
      image.draw(in: CGRect(origin: .zero, size: target))
    }
  }

  /// Average color (primary), the most colorful pixel (secondary) and a readable text color (on).
  private static func colors(of image: UIImage) -> [String: String] {
    let side = 16
    let fallback = ["primary": "#333333", "secondary": "#555555", "on": "#FFFFFF"]
    // Core Graphics owns the pixel buffer, so it stays valid while drawing.
    guard let cgImage = image.cgImage,
          let context = CGContext(
            data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: side * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          )
    else {
      return fallback
    }
    context.interpolationQuality = .medium
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: side, height: side))
    guard let raw = context.data else { return fallback }
    let pixels = UnsafeBufferPointer(start: raw.assumingMemoryBound(to: UInt8.self), count: side * side * 4)

    var sum = (r: 0, g: 0, b: 0)
    var best = (r: 0, g: 0, b: 0)
    var bestScore = -1.0
    for i in stride(from: 0, to: pixels.count, by: 4) {
      let r = Int(pixels[i]), g = Int(pixels[i + 1]), b = Int(pixels[i + 2])
      sum.r += r; sum.g += g; sum.b += b
      let maxC = Double(max(r, g, b)), minC = Double(min(r, g, b))
      let saturation = maxC == 0 ? 0 : (maxC - minC) / maxC
      let brightness = maxC / 255
      // Prefer saturated colors that are neither near-black nor near-white.
      let score = saturation * (1 - abs(brightness - 0.6))
      if score > bestScore {
        bestScore = score
        best = (r, g, b)
      }
    }
    let count = side * side
    let average = (r: sum.r / count, g: sum.g / count, b: sum.b / count)
    let on = luminance(average.r, average.g, average.b) > 0.45 ? "#000000" : "#FFFFFF"
    return ["primary": hex(average.r, average.g, average.b), "secondary": hex(best.r, best.g, best.b), "on": on]
  }

  private static func luminance(_ r: Int, _ g: Int, _ b: Int) -> Double {
    func channel(_ c: Int) -> Double {
      let s = Double(c) / 255
      return s <= 0.03928 ? s / 12.92 : pow((s + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }

  private static func hex(_ r: Int, _ g: Int, _ b: Int) -> String {
    String(format: "#%02X%02X%02X", r, g, b)
  }
}
