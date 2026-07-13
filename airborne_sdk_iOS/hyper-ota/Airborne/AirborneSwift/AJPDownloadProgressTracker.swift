//
//  AJPDownloadProgressTracker.swift
//  Airborne
//
//  Copyright © Juspay Technologies. All rights reserved.
//

import Foundation

/// Aggregates byte-level download progress across an update's blocking set — the index
/// split, the important splits, and the resources that gate boot. Lazy splits are excluded.
///
/// A file contributes to the totals only once it has been registered with a positive
/// expected size, which comes from its release-config `size`. Files whose size the release
/// config omits are ignored entirely, so `percent` never exceeds 100 and a server that
/// doesn't send `size` produces no callbacks rather than a misleading bar.
///
/// The callback is invoked outside the internal lock, so a slow consumer can never stall a
/// download thread or deadlock by re-entering the tracker. It is still delivered on a
/// background thread.
///
/// Percentages are *generated* monotonically — `lastEmittedPercent` advances under the lock,
/// so each value is produced at most once and never repeats. Because the callback fires after
/// the lock is released, two concurrent downloads can still deliver adjacent percentages out
/// of order. Consumers that need a strictly non-decreasing sequence must impose it themselves;
/// `AirborneServices` does exactly that before calling `AirborneDelegate.onDownloadProgress`.
final class AJPDownloadProgressTracker {

    typealias Callback = (_ bytesDownloaded: Int64, _ totalBytes: Int64, _ percent: Int) -> Void

    private struct Entry {
        var received: Int64
        let expected: Int64
    }

    private let callback: Callback
    private let lock = NSLock()

    private var entries: [String: Entry] = [:]

    /// Last percentage handed to the callback. We emit only on a strict increase, so the bar
    /// never regresses as the denominator grows while more downloads start.
    private var lastEmittedPercent = -1

    init(callback: @escaping Callback) {
        self.callback = callback
    }

    /// Adds a file's expected size to the denominator. Files with an unknown size are
    /// skipped, which keeps them out of the numerator too.
    func register(fileID: String, expectedBytes: Int64) {
        guard expectedBytes > 0 else { return }
        recompute { $0[fileID] = Entry(received: 0, expected: expectedBytes) }
    }

    /// Records the cumulative bytes received so far for an in-flight download.
    ///
    /// URLSession hands us absolute counters, not deltas, and a redirect or retry resets
    /// them to zero. Storing the absolute value means such a reset self-corrects rather than
    /// double-counting.
    func update(fileID: String, received: Int64) {
        recompute { entries in
            guard var entry = entries[fileID] else { return }
            entry.received = max(0, min(received, entry.expected))
            entries[fileID] = entry
        }
    }

    /// Marks a file fully downloaded, pinning its received count to its expected size. This
    /// guarantees the bar reaches 100 even when the release config's `size` disagrees with
    /// the bytes actually delivered.
    func complete(fileID: String) {
        recompute { entries in
            guard let entry = entries[fileID] else { return }
            entries[fileID] = Entry(received: entry.expected, expected: entry.expected)
        }
    }

    /// Drops a file that will never be downloaded — a resource skipped after boot timeout,
    /// for instance. Shrinking the denominator only raises the percentage, so this can never
    /// trip the monotonic guard.
    func cancel(fileID: String) {
        recompute { $0[fileID] = nil }
    }

    private func recompute(_ change: (inout [String: Entry]) -> Void) {
        var pending: (bytes: Int64, total: Int64, percent: Int)?

        lock.lock()
        change(&entries)

        var downloaded: Int64 = 0
        var total: Int64 = 0
        for entry in entries.values {
            downloaded += entry.received
            total += entry.expected
        }

        if total > 0 {
            // `received` is clamped to `expected` per file, so this is always 0...100.
            let percent = Int((downloaded * 100) / total)
            if percent > lastEmittedPercent {
                lastEmittedPercent = percent
                pending = (downloaded, total, percent)
            }
        }
        lock.unlock()

        if let pending = pending {
            callback(pending.bytes, pending.total, pending.percent)
        }
    }
}
