export interface ReleaseFile {
  file_path: string;
  url: string;
  checksum?: string;
  size?: number;
}

export interface ReleaseConfig {
  version: string;
  config: {
    version: string;
    boot_timeout: number;
    release_config_timeout: number;
    properties?: Record<string, unknown>;
  };
  package: {
    name: string;
    version: string;
    index: ReleaseFile;
    properties?: Record<string, unknown>;
    important: ReleaseFile[];
    lazy: ReleaseFile[];
  };
  resources: ReleaseFile[];
}

export type AirborneBootEvent =
  | {
      /**
       * `rollback`: a package failed to acknowledge its boot too many times
       * and is now blocked. `blocked-package`: the server still serves a
       * blocked package.
       */
      type: 'rollback' | 'blocked-package';
      packageVersion: string;
    }
  | {
      /**
       * Something failed without stopping the boot: an OTA bundle that could
       * not run (the bundled package ran instead), a package whose files
       * failed to download in the background (once per package and boot), an
       * acknowledged package whose cached files were gone (not kept as the
       * last good package), or state that could not be saved, which leaves
       * downloads and the boot guard unremembered.
       */
      type: 'error';
      message: string;
      /** The package concerned, when there is one. */
      packageVersion?: string;
    };

export interface AirborneWebOptions {
  /** `https://host/release/<organisation>/<application>` */
  releaseConfigUrl: string;
  /** Must match the application segment of `releaseConfigUrl`. */
  namespace: string;
  /** Sent as the `x-dimension` header, e.g. `{ app_version: '1.0.0' }`. */
  dimensions?: Record<string, string>;
  /**
   * The web equivalent of what ships in the binary: the release config and
   * files deployed with the host page. Used when nothing newer is available.
   */
  bundled: {
    releaseConfig: ReleaseConfig;
    /** Base URL that `file_path`s in `releaseConfig` resolve against. */
    baseUrl: string;
  };
  /**
   * Opt-in boot guard. OTA packages that boot without a `markBootSuccess()`
   * call too many times are blocked, and the last acknowledged package (or the
   * bundled one) runs instead.
   */
  bootGuardEnabled?: boolean;
  onEvent?: (event: AirborneBootEvent) => void;
}

export type BootSource = 'ota' | 'bundled';

export interface BootResult {
  source: BootSource;
  releaseConfig: ReleaseConfig;
  bundlePath: string;
  /** Set when a newer package missed the boot timeout. */
  pendingPackageVersion?: string;
}

export interface AirborneWebRuntime extends BootResult {
  files: Record<string, string>;
  /**
   * Resolves once the files that were already cached at boot (lazy package
   * files and resources) are in `files`. The bundle starts before that, so
   * readers of `files` wait for it. Never rejects.
   */
  ready?: Promise<void>;
}

declare global {
  interface Window {
    __AIRBORNE__?: Record<string, AirborneWebRuntime>;
  }
}
