// Copyright 2025 Juspay Technologies
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { EmitterSubscription } from 'react-native';

const LINKING_ERROR =
  `The package 'airborne-react-native' doesn't seem to be linked. Make sure: \n\n` +
  Platform.select({ ios: "- You have run 'pod install'\n", default: '' }) +
  '- You rebuilt the app after installing the package\n' +
  '- You are not using Expo Go\n';

// @ts-expect-error
const isTurboModuleEnabled = global.__turboModuleProxy != null;

const AirborneModule = isTurboModuleEnabled
  ? require('./NativeAirborne').default
  : NativeModules.Airborne;

const Airborne = AirborneModule
  ? AirborneModule
  : new Proxy(
      {},
      {
        get() {
          throw new Error(LINKING_ERROR);
        },
      }
    );

export function readReleaseConfig(nameSpace: string): Promise<string> {
  return Airborne.readReleaseConfig(nameSpace);
}

export function getFileContent(nameSpace: string, filePath: string): Promise<string> {
  return Airborne.getFileContent(nameSpace, filePath);
}

export function getBundlePath(nameSpace: string): Promise<string> {
  return Airborne.getBundlePath(nameSpace);
}

/**
 * Byte-level progress for the OTA update's blocking set — the index split, the important
 * splits and the resources that gate boot. Lazy splits are excluded.
 */
export type DownloadProgressEvent = {
  /** Bytes downloaded so far across the blocking set. */
  bytesDownloaded: number;
  /** Total expected bytes across the blocking set. */
  totalBytes: number;
  /** `bytesDownloaded` as a percentage of `totalBytes`, 0-100. Never decreases. */
  percent: number;
};

const DOWNLOAD_PROGRESS_EVENT = 'onDownloadProgress';

// Constructed lazily: when the module is missing, `Airborne` is a Proxy that throws on any
// property access, and NativeEventEmitter reads from it eagerly.
let progressEmitter: NativeEventEmitter | undefined;

/**
 * Subscribes to OTA download progress.
 *
 * Progress is only observable from JS when the app boots *before* the update finishes — i.e.
 * the boot timeout elapsed and the new package is still downloading in the background while
 * the app runs on the previous one. On a fast update the blocking set completes before the JS
 * bundle even loads, so no events are seen. The most recent value is replayed to a new
 * listener, so subscribing mid-download reports the current percentage immediately.
 *
 * Requires a server that sends `size` on release-config splits; without it no events fire.
 *
 * Currently emitted on iOS only. On Android this returns a subscription that never fires.
 *
 * @returns A subscription — call `.remove()` to stop listening.
 */
export function addDownloadProgressListener(
  listener: (event: DownloadProgressEvent) => void
): EmitterSubscription {
  if (!progressEmitter) {
    progressEmitter = new NativeEventEmitter(Airborne);
  }
  return progressEmitter.addListener(DOWNLOAD_PROGRESS_EVENT, listener);
}

export default Airborne;
