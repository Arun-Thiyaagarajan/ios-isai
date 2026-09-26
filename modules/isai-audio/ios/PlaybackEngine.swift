import AVFoundation
import MediaPlayer
import UIKit

/// One queue entry as sent from JS.
struct QueueEntry {
  let key: String
  let uri: String?
  /// "documents" or a base64 folder bookmark; `path` is inside it.
  let root: String?
  let path: String?
  let title: String
  let artist: String
  let album: String?
  var artworkUri: String?
  let durationMs: Double
  /// Volume levelling (ReplayGain) for this song, dB; 0 when the file has no tags.
  let trackGainDb: Double
  let albumGainDb: Double

  init(_ dict: [String: Any]) {
    key = dict["key"] as? String ?? UUID().uuidString
    uri = dict["uri"] as? String
    root = dict["root"] as? String
    path = dict["path"] as? String
    title = dict["title"] as? String ?? ""
    artist = dict["artist"] as? String ?? ""
    album = dict["album"] as? String
    artworkUri = dict["artworkUri"] as? String
    durationMs = (dict["durationMs"] as? NSNumber)?.doubleValue ?? 0
    trackGainDb = (dict["trackGainDb"] as? NSNumber)?.doubleValue ?? 0
    albumGainDb = (dict["albumGainDb"] as? NSNumber)?.doubleValue ?? 0
  }
}

/**
 * Isai's playback engine on iOS. The queue order is decided in JS; this plays the current item,
 * advances at the end (respecting repeat), and integrates with the system: lock screen and
 * Control Center, headphone/Bluetooth buttons, calls and other apps, unplugged headphones.
 *
 * Everything runs on the main thread.
 */
final class PlaybackEngine: NSObject {
  static let shared = PlaybackEngine()

  var onState: (([String: Any]) -> Void)?
  var onTransition: (([String: Any]) -> Void)?
  var onError: (([String: Any]) -> Void)?

  private let player = AVPlayer()
  private var entries: [QueueEntry] = []
  private var index = 0
  private var repeatMode = "off"
  private var ended = false
  private var consecutiveErrors = 0
  private let maxConsecutiveErrors = 5

  private var timeObserver: Any?
  private var itemStatusObservation: NSKeyValueObservation?
  private var controlStatusObservation: NSKeyValueObservation?
  private var endObserver: NSObjectProtocol?
  private var resolvedRoots: [String: URL] = [:]
  private var artworkCache: (uri: String, artwork: MPMediaItemArtwork)?
  /// "Show player on lock screen". Off: no Now Playing info and no remote commands.
  private var lockScreenControls = true

  private override init() {
    super.init()
    player.automaticallyWaitsToMinimizeStalling = false
    configureSession()
    configureRemoteCommands()

    timeObserver = player.addPeriodicTimeObserver(
      forInterval: CMTime(seconds: 1, preferredTimescale: 600),
      queue: .main
    ) { [weak self] _ in
      self?.emitState()
    }
    controlStatusObservation = player.observe(\.timeControlStatus) { [weak self] _, _ in
      DispatchQueue.main.async {
        self?.emitState()
        self?.updateNowPlayingPlayback()
      }
    }
  }

  // MARK: Queue

  func setQueue(_ items: [QueueEntry], index start: Int, positionMs: Double, play: Bool) {
    entries = items
    consecutiveErrors = 0
    guard !entries.isEmpty else {
      stop()
      return
    }
    load(min(max(start, 0), entries.count - 1), positionMs: positionMs, play: play)
  }

  func insert(at position: Int, _ items: [QueueEntry]) {
    let at = min(max(position, 0), entries.count)
    let wasEmpty = entries.isEmpty
    entries.insert(contentsOf: items, at: at)
    if wasEmpty {
      load(0, positionMs: 0, play: false)
    } else if at <= index {
      index += items.count
    }
    emitState()
  }

  func remove(from: Int, to: Int) {
    let lower = max(from, 0)
    let upper = min(to, entries.count)
    guard lower < upper else { return }
    let removingCurrent = (lower..<upper).contains(index)
    let wasPlaying = isPlaying
    entries.removeSubrange(lower..<upper)

    if entries.isEmpty {
      stop()
    } else if removingCurrent {
      load(min(lower, entries.count - 1), positionMs: 0, play: wasPlaying)
    } else {
      if index >= upper { index -= upper - lower }
      emitState()
    }
  }

  func move(from: Int, to: Int) {
    guard entries.indices.contains(from), entries.indices.contains(to), from != to else { return }
    let item = entries.remove(at: from)
    entries.insert(item, at: to)
    if from == index {
      index = to
    } else if from < index && to >= index {
      index -= 1
    } else if from > index && to <= index {
      index += 1
    }
    emitState()
  }

  // MARK: Transport

  var isPlaying: Bool { player.timeControlStatus != .paused }

  func play() {
    guard !entries.isEmpty else { return }
    activateSession()
    if ended || player.currentItem == nil {
      ended = false
      load(index, positionMs: 0, play: true)
      return
    }
    player.play()
  }

  func pause() {
    player.pause()
  }

  func seek(to ms: Double) {
    // Exact seek: AVPlayer's default tolerance lets it land on the nearest convenient point, which
    // in MP3/AAC files can be seconds away (the seek bar felt "sticky" to fixed spots).
    let target = CMTime(seconds: max(ms, 0) / 1000, preferredTimescale: 600)
    player.seek(to: target, toleranceBefore: .zero, toleranceAfter: .zero) { [weak self] _ in
      self?.emitState()
      self?.updateNowPlayingPlayback()
    }
  }

  func skipToNext() {
    guard !entries.isEmpty else { return }
    let next = index + 1
    if next < entries.count {
      emitTransition(completed: false, toIndex: next)
      load(next, positionMs: 0, play: true)
    } else if repeatMode == "all" {
      emitTransition(completed: false, toIndex: 0)
      load(0, positionMs: 0, play: true)
    }
  }

  /// Restarts the song after the first 3 seconds; otherwise goes to the previous one.
  func skipToPrevious() {
    guard !entries.isEmpty else { return }
    if currentSeconds > 3 || (index == 0 && repeatMode != "all") {
      seek(to: 0)
      return
    }
    let previous = index > 0 ? index - 1 : entries.count - 1
    emitTransition(completed: false, toIndex: previous)
    load(previous, positionMs: 0, play: true)
  }

  func skip(to target: Int) {
    guard entries.indices.contains(target) else { return }
    emitTransition(completed: false, toIndex: target)
    load(target, positionMs: 0, play: true)
  }

  /// Shows or hides the lock screen / Control Center player. Playback itself is unaffected.
  func setLockScreenControls(_ enabled: Bool) {
    lockScreenControls = enabled
    let center = MPRemoteCommandCenter.shared()
    for command in [
      center.playCommand, center.pauseCommand, center.togglePlayPauseCommand,
      center.nextTrackCommand, center.previousTrackCommand, center.changePlaybackPositionCommand,
    ] {
      command.isEnabled = enabled
    }
    if enabled {
      updateNowPlayingInfo()
    } else {
      MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    }
  }

  /// A queued song's artwork changed (e.g. its thumbnail was just made); refresh the lock screen.
  func updateArtwork(key: String, uri: String) {
    for i in entries.indices where entries[i].key == key {
      entries[i].artworkUri = uri
    }
    if entries.indices.contains(index), entries[index].key == key {
      updateNowPlayingInfo()
    }
  }

  func setRepeat(_ mode: String) {
    repeatMode = mode
    emitState()
  }

  func state() -> [String: Any] {
    var dict: [String: Any] = [
      "index": index,
      "isPlaying": isPlaying,
      "isBuffering": player.timeControlStatus == .waitingToPlayAtSpecifiedRate,
      "ended": ended,
      "positionMs": currentSeconds * 1000,
      "durationMs": currentDurationMs,
      "queueLength": entries.count,
      "repeat": repeatMode,
      "timestamp": Date().timeIntervalSince1970 * 1000,
    ]
    dict["key"] = entries.indices.contains(index) ? entries[index].key : nil
    return dict
  }

  func keys() -> [String] { entries.map(\.key) }

  // MARK: Loading

  private var currentSeconds: Double {
    let seconds = player.currentTime().seconds
    return seconds.isFinite ? seconds : 0
  }

  private var currentDurationMs: Double {
    if let duration = player.currentItem?.duration.seconds, duration.isFinite, duration > 0 {
      return duration * 1000
    }
    return entries.indices.contains(index) ? entries[index].durationMs : 0
  }

  private func load(_ newIndex: Int, positionMs: Double, play: Bool) {
    index = newIndex
    ended = false
    let entry = entries[newIndex]

    guard let url = resolveURL(entry) else {
      failCurrent(message: "The file’s folder is no longer available.")
      return
    }

    let asset = AVURLAsset(url: url)
    let item = AVPlayerItem(asset: asset)
    // Equalizer, bass boost and volume levelling run on the decoded audio of every song.
    item.audioMix = AudioEffects.shared.audioMix(for: asset, trackGainDb: entry.trackGainDb, albumGainDb: entry.albumGainDb)
    itemStatusObservation = item.observe(\.status) { [weak self] item, _ in
      DispatchQueue.main.async { self?.itemStatusChanged(item) }
    }
    if let endObserver { NotificationCenter.default.removeObserver(endObserver) }
    endObserver = NotificationCenter.default.addObserver(
      forName: .AVPlayerItemDidPlayToEndTime, object: item, queue: .main
    ) { [weak self] _ in
      self?.itemFinished()
    }

    player.replaceCurrentItem(with: item)
    if positionMs > 0 {
      player.seek(to: CMTime(seconds: positionMs / 1000, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
    }
    if play {
      activateSession()
      player.play()
    } else {
      player.pause()
    }
    updateNowPlayingInfo()
    emitState()
  }

  private func itemStatusChanged(_ item: AVPlayerItem) {
    guard item === player.currentItem else { return }
    switch item.status {
    case .readyToPlay:
      consecutiveErrors = 0
      updateNowPlayingInfo()
      emitState()
    case .failed:
      failCurrent(message: item.error?.localizedDescription ?? "This file can’t be played.")
    default:
      break
    }
  }

  /// Reports a broken file and moves on, but gives up after several failures in a row.
  private func failCurrent(message: String) {
    onError?(["key": entries.indices.contains(index) ? entries[index].key : NSNull(), "message": message])
    consecutiveErrors += 1
    let next = index + 1
    if consecutiveErrors < maxConsecutiveErrors, next < entries.count {
      load(next, positionMs: 0, play: true)
    } else {
      player.pause()
      emitState()
    }
  }

  private func itemFinished() {
    if repeatMode == "one" {
      emitTransition(completed: true, toIndex: index)
      seek(to: 0)
      player.play()
      return
    }
    let next = index + 1
    if next < entries.count {
      emitTransition(completed: true, toIndex: next)
      load(next, positionMs: 0, play: true)
    } else if repeatMode == "all", !entries.isEmpty {
      emitTransition(completed: true, toIndex: 0)
      load(0, positionMs: 0, play: true)
    } else {
      // End of the queue: stay on the last song, stopped.
      emitTransition(completed: true, toIndex: nil)
      ended = true
      player.pause()
      emitState()
    }
  }

  /**
   * A saved file URL, found again if needed. iOS moves the app's folder when a new build is
   * installed, so saved absolute paths go stale; the file keeps its place inside Caches or
   * Documents, so look for it there in today's folder.
   */
  static func localFile(_ uri: String) -> URL? {
    guard let url = URL(string: uri), url.isFileURL else { return nil }
    let fileManager = FileManager.default
    if fileManager.fileExists(atPath: url.path) { return url }
    let bases: [(marker: String, directory: FileManager.SearchPathDirectory)] = [
      ("/Library/Caches/", .cachesDirectory),
      ("/Documents/", .documentDirectory),
    ]
    for base in bases {
      guard let range = url.path.range(of: base.marker),
            let root = fileManager.urls(for: base.directory, in: .userDomainMask).first
      else { continue }
      let candidate = root.appendingPathComponent(String(url.path[range.upperBound...]))
      if fileManager.fileExists(atPath: candidate.path) { return candidate }
    }
    return nil
  }

  private func stop() {
    player.pause()
    player.replaceCurrentItem(with: nil)
    entries = []
    index = 0
    ended = false
    MPNowPlayingInfoCenter.default().nowPlayingInfo = nil
    emitState()
  }

  private func resolveURL(_ entry: QueueEntry) -> URL? {
    if let uri = entry.uri, let url = URL(string: uri) {
      return url
    }
    guard let root = entry.root, let path = entry.path else { return nil }
    if root == "documents" {
      return FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent(path)
    }
    if let base = resolvedRoots[root] {
      return base.appendingPathComponent(path)
    }
    guard let data = Data(base64Encoded: root) else { return nil }
    var stale = false
    guard let base = try? URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &stale),
          base.startAccessingSecurityScopedResource()
    else { return nil }
    // Access stays open for the app's lifetime so every song in the folder can play.
    resolvedRoots[root] = base
    return base.appendingPathComponent(path)
  }

  // MARK: Events

  private func emitState() {
    onState?(state())
  }

  private func emitTransition(completed: Bool, toIndex: Int?) {
    guard entries.indices.contains(index) else { return }
    let duration = currentDurationMs
    var event: [String: Any] = [
      "fromKey": entries[index].key,
      "completed": completed,
      "playedMs": completed ? duration : currentSeconds * 1000,
      "durationMs": duration,
    ]
    if let toIndex, entries.indices.contains(toIndex) {
      event["toKey"] = entries[toIndex].key
    }
    onTransition?(event)
  }

  // MARK: System integration

  private func configureSession() {
    let session = AVAudioSession.sharedInstance()
    try? session.setCategory(.playback, mode: .default, policy: .longFormAudio)

    NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification, object: session, queue: .main
    ) { [weak self] note in
      guard let self,
            let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
            let type = AVAudioSession.InterruptionType(rawValue: raw)
      else { return }
      if type == .ended,
         let optionsRaw = note.userInfo?[AVAudioSessionInterruptionOptionKey] as? UInt,
         AVAudioSession.InterruptionOptions(rawValue: optionsRaw).contains(.shouldResume) {
        self.play() // e.g. after a phone call
      }
      self.emitState()
    }

    NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification, object: session, queue: .main
    ) { [weak self] note in
      guard let raw = note.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt,
            AVAudioSession.RouteChangeReason(rawValue: raw) == .oldDeviceUnavailable
      else { return }
      self?.pause() // headphones unplugged or Bluetooth disconnected
    }
  }

  private func activateSession() {
    try? AVAudioSession.sharedInstance().setActive(true)
  }

  private func configureRemoteCommands() {
    let center = MPRemoteCommandCenter.shared()
    center.playCommand.addTarget { [weak self] _ in
      self?.play()
      return .success
    }
    center.pauseCommand.addTarget { [weak self] _ in
      self?.pause()
      return .success
    }
    center.togglePlayPauseCommand.addTarget { [weak self] _ in
      guard let self else { return .commandFailed }
      self.isPlaying ? self.pause() : self.play()
      return .success
    }
    center.nextTrackCommand.addTarget { [weak self] _ in
      self?.skipToNext()
      return .success
    }
    center.previousTrackCommand.addTarget { [weak self] _ in
      self?.skipToPrevious()
      return .success
    }
    center.changePlaybackPositionCommand.addTarget { [weak self] event in
      guard let event = event as? MPChangePlaybackPositionCommandEvent else { return .commandFailed }
      self?.seek(to: event.positionTime * 1000)
      return .success
    }
  }

  private func updateNowPlayingInfo() {
    guard lockScreenControls, entries.indices.contains(index) else { return }
    let entry = entries[index]
    var info: [String: Any] = [
      MPMediaItemPropertyTitle: entry.title,
      MPMediaItemPropertyArtist: entry.artist,
      MPMediaItemPropertyPlaybackDuration: currentDurationMs / 1000,
      MPNowPlayingInfoPropertyElapsedPlaybackTime: currentSeconds,
      MPNowPlayingInfoPropertyPlaybackRate: isPlaying ? 1.0 : 0.0,
    ]
    if let album = entry.album {
      info[MPMediaItemPropertyAlbumTitle] = album
    }
    if let artwork = artwork(for: entry.artworkUri) {
      info[MPMediaItemPropertyArtwork] = artwork
    }
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  private func updateNowPlayingPlayback() {
    guard lockScreenControls, var info = MPNowPlayingInfoCenter.default().nowPlayingInfo else { return }
    info[MPNowPlayingInfoPropertyElapsedPlaybackTime] = currentSeconds
    info[MPNowPlayingInfoPropertyPlaybackRate] = isPlaying ? 1.0 : 0.0
    info[MPMediaItemPropertyPlaybackDuration] = currentDurationMs / 1000
    MPNowPlayingInfoCenter.default().nowPlayingInfo = info
  }

  private func artwork(for uri: String?) -> MPMediaItemArtwork? {
    guard let uri else { return nil }
    if let cached = artworkCache, cached.uri == uri {
      return cached.artwork
    }
    guard let url = Self.localFile(uri), let image = UIImage(contentsOfFile: url.path) else { return nil }
    let artwork = MPMediaItemArtwork(boundsSize: image.size) { _ in image }
    artworkCache = (uri, artwork)
    return artwork
  }
}
