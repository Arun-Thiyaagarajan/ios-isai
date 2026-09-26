import AVFoundation
import ExpoModulesCore
import UIKit
import UniformTypeIdentifiers

/**
 * iOS side of the Isai music library.
 *
 * iOS has no system-wide music-file index apps can read, so Isai only sees:
 * - folders the user picks (remembered with security-scoped bookmarks), and
 * - the app's own Documents folder (visible in the Files app as "On My iPhone › Isai").
 *
 * A "root" argument is either "documents" or a base64 bookmark returned by `pickFolder`.
 */
public class IsaiLibraryModule: Module {
  private var pickerDelegate: FolderPickerDelegate?

  public func definition() -> ModuleDefinition {
    Name("IsaiLibrary")

    AsyncFunction("pickFolder") { (promise: Promise) in
      guard let presenter = self.appContext?.utilities?.currentViewController() else {
        promise.reject(NoPresenterException())
        return
      }
      let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder])
      picker.allowsMultipleSelection = false
      let delegate = FolderPickerDelegate { [weak self] url in
        self?.pickerDelegate = nil
        guard let url else {
          promise.resolve(nil)
          return
        }
        do {
          promise.resolve(try Self.makeBookmark(for: url))
        } catch {
          promise.reject(BookmarkException(error.localizedDescription))
        }
      }
      picker.delegate = delegate
      self.pickerDelegate = delegate
      presenter.present(picker, animated: true)
    }.runOnQueue(.main)

    AsyncFunction("listAudioFiles") { (root: String) async throws -> [String: Any] in
      try Self.withRoot(root) { base, refreshedBookmark in
        var result: [String: Any] = ["files": Self.listAudioFiles(in: base)]
        if let refreshedBookmark {
          result["refreshedBookmark"] = refreshedBookmark
        }
        return result
      }
    }

    AsyncFunction("readTags") { (root: String, paths: [String]) async throws -> [[String: Any]] in
      let access = try Self.resolveRoot(root)
      defer { access.stop() }
      return await TagReader.read(base: access.url, paths: paths).map { $0.dictionary }
    }

    /// Saves a square thumbnail of a file's artwork; nil when there is none.
    AsyncFunction("getArtwork") { (root: String, path: String, key: String, size: Int) async throws -> [String: Any]? in
      let access = try Self.resolveRoot(root)
      defer { access.stop() }
      return await ArtworkExtractor.extract(
        fileURL: access.url.appendingPathComponent(path),
        key: key,
        size: size
      )
    }
  }

  // MARK: Roots and bookmarks

  private static let documentsRoot = "documents"

  private struct RootAccess {
    let url: URL
    let refreshedBookmark: String?
    let scoped: Bool

    func stop() {
      if scoped {
        url.stopAccessingSecurityScopedResource()
      }
    }
  }

  private static func makeBookmark(for url: URL) throws -> [String: Any] {
    let scoped = url.startAccessingSecurityScopedResource()
    defer {
      if scoped { url.stopAccessingSecurityScopedResource() }
    }
    let data = try url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
    return ["name": url.lastPathComponent, "bookmark": data.base64EncodedString()]
  }

  private static func resolveRoot(_ root: String) throws -> RootAccess {
    if root == documentsRoot {
      let url = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      return RootAccess(url: url, refreshedBookmark: nil, scoped: false)
    }
    guard let data = Data(base64Encoded: root) else {
      throw BookmarkException("Invalid folder reference")
    }
    var isStale = false
    let url: URL
    do {
      url = try URL(resolvingBookmarkData: data, options: [], relativeTo: nil, bookmarkDataIsStale: &isStale)
    } catch {
      throw FolderUnavailableException()
    }
    guard url.startAccessingSecurityScopedResource() else {
      throw FolderUnavailableException()
    }
    var refreshed: String?
    if isStale {
      refreshed = try? url.bookmarkData(options: .minimalBookmark, includingResourceValuesForKeys: nil, relativeTo: nil)
        .base64EncodedString()
    }
    return RootAccess(url: url, refreshedBookmark: refreshed, scoped: true)
  }

  private static func withRoot<T>(_ root: String, _ body: (URL, String?) throws -> T) throws -> T {
    let access = try resolveRoot(root)
    defer { access.stop() }
    return try body(access.url, access.refreshedBookmark)
  }

  // MARK: File listing

  static let audioExtensions: Set<String> = [
    "mp3", "m4a", "m4b", "aac", "wav", "aif", "aiff", "aifc", "caf", "flac",
    "alac", "ogg", "oga", "opus", "wma",
  ]

  private static func listAudioFiles(in base: URL) -> [[String: Any]] {
    let keys: [URLResourceKey] = [.isRegularFileKey, .fileSizeKey, .contentModificationDateKey]
    guard let enumerator = FileManager.default.enumerator(
      at: base,
      includingPropertiesForKeys: keys,
      // Hidden files include iCloud placeholders (".Song.mp3.icloud") that aren't downloaded yet.
      options: [.skipsHiddenFiles, .skipsPackageDescendants]
    ) else {
      return []
    }

    let basePath = base.standardizedFileURL.path
    var files: [[String: Any]] = []
    for case let url as URL in enumerator {
      guard audioExtensions.contains(url.pathExtension.lowercased()),
            let values = try? url.resourceValues(forKeys: Set(keys)),
            values.isRegularFile == true
      else { continue }

      let fullPath = url.standardizedFileURL.path
      let relative = fullPath.hasPrefix(basePath)
        ? String(fullPath.dropFirst(basePath.count)).trimmingCharacters(in: CharacterSet(charactersIn: "/"))
        : url.lastPathComponent
      files.append([
        "path": relative,
        "uri": url.absoluteString,
        "fileSize": values.fileSize ?? 0,
        "dateModified": (values.contentModificationDate?.timeIntervalSince1970 ?? 0) * 1000,
      ])
    }
    return files
  }
}

// MARK: - Folder picker

private final class FolderPickerDelegate: NSObject, UIDocumentPickerDelegate {
  private let completion: (URL?) -> Void

  init(completion: @escaping (URL?) -> Void) {
    self.completion = completion
  }

  func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
    completion(urls.first)
  }

  func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
    completion(nil)
  }
}

// MARK: - Errors

final class NoPresenterException: Exception, @unchecked Sendable {
  override var reason: String { "Couldn't find a screen to show the folder picker on" }
}

final class FolderUnavailableException: Exception, @unchecked Sendable {
  override var reason: String { "The folder is no longer available. It may have been moved, deleted or disconnected." }
}

final class BookmarkException: GenericException<String>, @unchecked Sendable {
  override var reason: String { "Couldn't remember the folder: \(param)" }
}
