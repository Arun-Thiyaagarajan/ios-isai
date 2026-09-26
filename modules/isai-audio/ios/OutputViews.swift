import AVKit
import ExpoModulesCore
import MediaPlayer
import UIKit

/// The system volume slider. Apps can only change the iPhone's volume through `MPVolumeView`,
/// so this wraps it and restyles its slider to match the player: flat colors, small round thumb.
final class IsaiVolumeView: ExpoView {
  private let volumeView = MPVolumeView(frame: .zero)

  var fillColor: UIColor = .white { didSet { applyStyle() } }
  var trackColor: UIColor = UIColor.white.withAlphaComponent(0.25) { didSet { applyStyle() } }

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // The output picker has its own button in the player; hide the old built-in one.
    // (Deprecated but still honored; a compiler warning only.)
    volumeView.showsRouteButton = false
    addSubview(volumeView)
    applyStyle()
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    // MPVolumeView places its slider wherever it likes inside its frame (usually near the top),
    // so lay it out, then shift the whole view until the slider's track sits exactly on our
    // vertical center, in line with the speaker icons beside it.
    volumeView.frame = bounds
    volumeView.layoutIfNeeded()
    if let slider {
      let trackMidY = slider.frame.midY
      volumeView.frame = bounds.offsetBy(dx: 0, dy: bounds.midY - trackMidY)
    }
    applyStyle()
  }

  private var slider: UISlider? {
    volumeView.subviews.lazy.compactMap { $0 as? UISlider }.first
  }

  private func applyStyle() {
    guard let slider else { return }
    slider.minimumTrackTintColor = fillColor
    slider.maximumTrackTintColor = trackColor
    let thumb = Self.thumbImage(color: fillColor, diameter: 14)
    slider.setThumbImage(thumb, for: .normal)
    slider.setThumbImage(thumb, for: .highlighted)
  }

  private static func thumbImage(color: UIColor, diameter: CGFloat) -> UIImage {
    let size = CGSize(width: diameter, height: diameter)
    return UIGraphicsImageRenderer(size: size).image { context in
      color.setFill()
      context.cgContext.fillEllipse(in: CGRect(origin: .zero, size: size))
    }
  }
}

/// The AirPlay / Bluetooth output picker button (`AVRoutePickerView`), tinted to the player.
final class IsaiRoutePickerView: ExpoView {
  private let picker = AVRoutePickerView(frame: .zero)

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    picker.prioritizesVideoDevices = false
    picker.tintColor = .white
    addSubview(picker)
  }

  var buttonColor: UIColor = .white {
    didSet { picker.tintColor = buttonColor }
  }

  var activeColor: UIColor = .white {
    didSet { picker.activeTintColor = activeColor }
  }

  override func layoutSubviews() {
    super.layoutSubviews()
    picker.frame = bounds
  }
}
