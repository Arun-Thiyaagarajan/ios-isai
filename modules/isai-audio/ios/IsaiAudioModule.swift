import ExpoModulesCore
import UIKit

/// Bridges `PlaybackEngine` to JS. Every call runs on the main thread, where the engine lives.
public class IsaiAudioModule: Module {
  private var engine: PlaybackEngine { PlaybackEngine.shared }

  public func definition() -> ModuleDefinition {
    Name("IsaiAudio")
    Events("onPlaybackState", "onTransition", "onError")

    OnCreate {
      DispatchQueue.main.async {
        let engine = PlaybackEngine.shared
        engine.onState = { [weak self] in self?.sendEvent("onPlaybackState", $0) }
        engine.onTransition = { [weak self] in self?.sendEvent("onTransition", $0) }
        engine.onError = { [weak self] in self?.sendEvent("onError", $0) }
      }
    }

    AsyncFunction("setQueue") { (items: [[String: Any]], index: Int, positionMs: Double, play: Bool) in
      self.engine.setQueue(items.map(QueueEntry.init), index: index, positionMs: positionMs, play: play)
    }.runOnQueue(.main)

    AsyncFunction("insert") { (at: Int, items: [[String: Any]]) in
      self.engine.insert(at: at, items.map(QueueEntry.init))
    }.runOnQueue(.main)

    AsyncFunction("remove") { (from: Int, to: Int) in
      self.engine.remove(from: from, to: to)
    }.runOnQueue(.main)

    AsyncFunction("move") { (from: Int, to: Int) in
      self.engine.move(from: from, to: to)
    }.runOnQueue(.main)

    AsyncFunction("play") { self.engine.play() }.runOnQueue(.main)
    AsyncFunction("pause") { self.engine.pause() }.runOnQueue(.main)
    AsyncFunction("seekTo") { (positionMs: Double) in self.engine.seek(to: positionMs) }.runOnQueue(.main)
    AsyncFunction("skipToNext") { self.engine.skipToNext() }.runOnQueue(.main)
    AsyncFunction("skipToPrevious") { self.engine.skipToPrevious() }.runOnQueue(.main)
    AsyncFunction("skipTo") { (index: Int) in self.engine.skip(to: index) }.runOnQueue(.main)
    AsyncFunction("updateArtwork") { (key: String, uri: String) in
      self.engine.updateArtwork(key: key, uri: uri)
    }.runOnQueue(.main)

    /// Equalizer, bass boost, overall gain and levelling mode; applies to the playing song at once.
    AsyncFunction("setAudioEffects") { (settings: [String: Any]) in
      AudioEffects.shared.update(EffectsSettings(settings))
    }

    AsyncFunction("setLockScreenControls") { (enabled: Bool) in
      self.engine.setLockScreenControls(enabled)
    }.runOnQueue(.main)

    AsyncFunction("setRepeatMode") { (mode: String) in self.engine.setRepeat(mode) }.runOnQueue(.main)

    // Output controls for Now Playing: the system volume slider and the AirPlay/Bluetooth picker.
    View(IsaiVolumeView.self) {
      Prop("fillColor") { (view: IsaiVolumeView, color: UIColor) in view.fillColor = color }
      Prop("trackColor") { (view: IsaiVolumeView, color: UIColor) in view.trackColor = color }
    }

    View(IsaiRoutePickerView.self) {
      Prop("buttonColor") { (view: IsaiRoutePickerView, color: UIColor) in view.buttonColor = color }
      Prop("activeColor") { (view: IsaiRoutePickerView, color: UIColor) in view.activeColor = color }
    }

    AsyncFunction("getState") { () -> [String: Any] in
      var state = self.engine.state()
      state["keys"] = self.engine.keys()
      return state
    }.runOnQueue(.main)
  }
}
