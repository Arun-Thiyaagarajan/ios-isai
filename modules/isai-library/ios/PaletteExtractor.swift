import UIKit

/**
 * Six named colors from an image, matching what AndroidX Palette gives on Android, so both
 * platforms theme the player the same way:
 * dominant, vibrant, darkVibrant, lightVibrant, muted, darkMuted.
 *
 * The image is shrunk to 48×48, pixels are grouped into color buckets (quantized to 4 bits per
 * channel), and each named color is the best-scoring bucket for its lightness/saturation target.
 * A swatch is left out when the image has nothing close to it; JS fills the gaps.
 */
enum PaletteExtractor {
  private struct Bucket {
    var r = 0, g = 0, b = 0, count = 0
    var color: (r: Double, g: Double, b: Double) {
      (Double(r) / Double(count) / 255, Double(g) / Double(count) / 255, Double(b) / Double(count) / 255)
    }
  }

  private struct Target {
    let name: String
    let lightness: ClosedRange<Double>
    let idealLightness: Double
    let saturation: ClosedRange<Double>
    let idealSaturation: Double
  }

  // Same targets as AndroidX Palette's Target defaults.
  private static let targets = [
    Target(name: "vibrant", lightness: 0.3...0.7, idealLightness: 0.5, saturation: 0.35...1, idealSaturation: 1),
    Target(name: "lightVibrant", lightness: 0.55...1, idealLightness: 0.74, saturation: 0.35...1, idealSaturation: 1),
    Target(name: "darkVibrant", lightness: 0...0.45, idealLightness: 0.26, saturation: 0.35...1, idealSaturation: 1),
    Target(name: "muted", lightness: 0.3...0.7, idealLightness: 0.5, saturation: 0...0.4, idealSaturation: 0.3),
    Target(name: "darkMuted", lightness: 0...0.45, idealLightness: 0.26, saturation: 0...0.4, idealSaturation: 0.3),
  ]

  static func palette(of image: UIImage) -> [String: String] {
    let side = 48
    guard let cgImage = image.cgImage,
          let context = CGContext(
            data: nil, width: side, height: side, bitsPerComponent: 8, bytesPerRow: side * 4,
            space: CGColorSpaceCreateDeviceRGB(),
            bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue
          )
    else { return [:] }
    context.interpolationQuality = .medium
    context.draw(cgImage, in: CGRect(x: 0, y: 0, width: side, height: side))
    guard let raw = context.data else { return [:] }
    let pixels = UnsafeBufferPointer(start: raw.assumingMemoryBound(to: UInt8.self), count: side * side * 4)

    var buckets: [Int: Bucket] = [:]
    for i in stride(from: 0, to: pixels.count, by: 4) {
      let r = Int(pixels[i]), g = Int(pixels[i + 1]), b = Int(pixels[i + 2])
      let key = (r >> 4) << 8 | (g >> 4) << 4 | (b >> 4)
      var bucket = buckets[key] ?? Bucket()
      bucket.r += r; bucket.g += g; bucket.b += b; bucket.count += 1
      buckets[key] = bucket
    }
    let all = Array(buckets.values)
    guard let dominant = all.max(by: { $0.count < $1.count }) else { return [:] }
    let maxCount = Double(dominant.count)

    var result = ["dominant": hex(dominant.color)]
    var used = Set<String>()
    for target in targets {
      var best: (score: Double, hex: String)?
      for bucket in all {
        let (s, l) = saturationAndLightness(bucket.color)
        guard target.lightness.contains(l), target.saturation.contains(s) else { continue }
        let value = hex(bucket.color)
        guard !used.contains(value) else { continue }
        // Palette's weighting: saturation and lightness closeness, then how much of the image it covers.
        let score = (1 - abs(s - target.idealSaturation)) * 0.24
          + (1 - abs(l - target.idealLightness)) * 0.52
          + (Double(bucket.count) / maxCount) * 0.24
        if best == nil || score > best!.score {
          best = (score, value)
        }
      }
      if let best {
        result[target.name] = best.hex
        used.insert(best.hex)
      }
    }
    return result
  }

  /// HSL saturation and lightness, 0…1.
  private static func saturationAndLightness(_ c: (r: Double, g: Double, b: Double)) -> (Double, Double) {
    let maxC = max(c.r, c.g, c.b), minC = min(c.r, c.g, c.b)
    let l = (maxC + minC) / 2
    guard maxC != minC else { return (0, l) }
    let d = maxC - minC
    return (l > 0.5 ? d / (2 - maxC - minC) : d / (maxC + minC), l)
  }

  private static func hex(_ c: (r: Double, g: Double, b: Double)) -> String {
    String(format: "#%02X%02X%02X", Int((c.r * 255).rounded()), Int((c.g * 255).rounded()), Int((c.b * 255).rounded()))
  }
}
