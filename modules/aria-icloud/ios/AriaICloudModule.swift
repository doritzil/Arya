import ExpoModulesCore
import Foundation

/// `aria-icloud` (ARCHITECTURE.md §8.3) — SKELETON, lowest priority (Phase 4b, only if time allows).
///
/// Mirrors `Documents/Projects/<id>/` ⇄ `iCloud Drive/Aria/Projects/<id>/` in the app's ubiquity container.
/// Requires the iCloud Documents entitlement + container (plugins/withICloud, opt-in via plugin props).
///
/// Conflict rule (to implement): per file, last-writer-wins by `manifest.updatedAt`; `edits.json` conflicts
/// keep both versions and merge ops by timestamp. `library.json` (songs) is merged by the JS side.
public final class AriaICloudModule: Module {
  private let queue = DispatchQueue(label: "com.aria.icloud", qos: .utility)
  private var metadataQuery: NSMetadataQuery?
  private var queryObserver: NSObjectProtocol?
  private var enabled = false

  public func definition() -> ModuleDefinition {
    Name("AriaICloud")

    Events("syncStatus")

    AsyncFunction("isAvailable") { () -> Bool in
      // ubiquityIdentityToken is nil when signed out or iCloud Drive is off for this app.
      guard FileManager.default.ubiquityIdentityToken != nil else { return false }
      // Must not be called on the main thread (it can block while the container is set up).
      return FileManager.default.url(forUbiquityContainerIdentifier: nil) != nil
    }
    .runOnQueue(queue)

    AsyncFunction("setEnabled") { (on: Bool, projectsDir: String) -> Void in
      self.enabled = on
      if on {
        DispatchQueue.main.async { self.startWatching() }
      } else {
        DispatchQueue.main.async { self.stopWatching() }
      }
      _ = projectsDir
    }
    .runOnQueue(queue)

    AsyncFunction("syncNow") { (projectsDir: String) -> [String: Any] in
      guard self.enabled, let container = self.cloudProjectsDir() else {
        self.sendEvent("syncStatus", ["state": "unavailable"])
        return ["uploaded": 0, "downloaded": 0, "conflicts": 0]
      }
      self.sendEvent("syncStatus", ["state": "syncing"])
      let local = projectsDir.hasPrefix("file://") ? URL(string: projectsDir)! : URL(fileURLWithPath: projectsDir)
      let result = self.mirror(local: local, cloud: container)
      self.sendEvent("syncStatus", ["state": "idle"])
      return result
    }
    .runOnQueue(queue)

    OnDestroy {
      DispatchQueue.main.async { self.stopWatching() }
    }
  }

  private func cloudProjectsDir() -> URL? {
    guard let root = FileManager.default.url(forUbiquityContainerIdentifier: nil) else { return nil }
    let dir = root.appendingPathComponent("Documents/Aria/Projects", isDirectory: true)
    try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    return dir
  }

  /// Two-way mirror of project folders. Every file access goes through NSFileCoordinator.
  private func mirror(local: URL, cloud: URL) -> [String: Any] {
    var uploaded = 0, downloaded = 0, conflicts = 0
    let fm = FileManager.default
    let coordinator = NSFileCoordinator(filePresenter: nil)
    let localIds = Set((try? fm.contentsOfDirectory(atPath: local.path)) ?? [])
    let cloudIds = Set((try? fm.contentsOfDirectory(atPath: cloud.path)) ?? [])

    // Upload projects that only exist locally.
    for id in localIds.subtracting(cloudIds) where !id.hasPrefix(".") {
      var err: NSError?
      coordinator.coordinate(writingItemAt: cloud.appendingPathComponent(id), options: .forReplacing, error: &err) { dst in
        if (try? fm.copyItem(at: local.appendingPathComponent(id), to: dst)) != nil { uploaded += 1 }
      }
    }

    // Download projects that only exist in iCloud (may be placeholders until downloaded).
    for id in cloudIds.subtracting(localIds) where !id.hasPrefix(".") {
      let src = cloud.appendingPathComponent(id)
      try? fm.startDownloadingUbiquitousItem(at: src)
      // TODO: wait for NSMetadataUbiquitousItemDownloadingStatusCurrent via the metadata query before copying;
      // copying a not-yet-downloaded folder copies placeholders only.
      var err: NSError?
      coordinator.coordinate(readingItemAt: src, options: [], error: &err) { readURL in
        if (try? fm.copyItem(at: readURL, to: local.appendingPathComponent(id))) != nil { downloaded += 1 }
      }
    }

    // TODO: projects present on both sides — compare manifest.json `updatedAt`; newer side wins per file;
    // for edits.json keep both and merge ops by timestamp; count `conflicts`.
    // TODO: deletions (tombstones in a `.deleted` list) so a delete on one device propagates.
    _ = conflicts
    conflicts = 0
    return ["uploaded": uploaded, "downloaded": downloaded, "conflicts": conflicts]
  }

  /// Watches the container for remote changes (another device added/updated a project).
  private func startWatching() {
    guard metadataQuery == nil else { return }
    let q = NSMetadataQuery()
    q.searchScopes = [NSMetadataQueryUbiquitousDocumentsScope]
    q.predicate = NSPredicate(format: "%K LIKE '*.json'", NSMetadataItemFSNameKey)
    queryObserver = NotificationCenter.default.addObserver(forName: .NSMetadataQueryDidUpdate, object: q, queue: .main) { [weak self] _ in
      // TODO: debounce, then sync the changed project ids only and tell JS to rebuild the index.
      self?.sendEvent("syncStatus", ["state": "idle", "message": "remoteChange"])
    }
    q.start()
    metadataQuery = q
  }

  private func stopWatching() {
    metadataQuery?.stop()
    if let o = queryObserver { NotificationCenter.default.removeObserver(o) }
    queryObserver = nil
    metadataQuery = nil
  }
}
