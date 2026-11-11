import { configureTelemetry, event } from './telemetry';
import type {
  AirborneBootEvent,
  AirborneWebOptions,
  AirborneWebRuntime,
  BootResult,
  ReleaseConfig,
  ReleaseFile,
} from './types';

/**
 * Cache and lock names: `airborne:<namespace>:<kind>[:<version>]`, with the
 * namespace and version encoded, so that no namespace's names are a prefix of
 * another's (namespace "a" against "a:package:b").
 */
const scopedName = (namespace: string, kind: string, version?: string) =>
  version === undefined
    ? `airborne:${encodeURIComponent(namespace)}:${kind}`
    : `airborne:${encodeURIComponent(namespace)}:${kind}:${encodeURIComponent(version)}`;

const packageCacheName = (namespace: string, version: string) =>
  scopedName(namespace, 'package', version);
const resourceCacheName = (namespace: string) =>
  scopedName(namespace, 'resources');
const stateKey = (namespace: string) => `airborne:${namespace}:state`;
const tossKey = (namespace: string) => `airborne:${namespace}:toss`;
const commitLockName = (namespace: string) => scopedName(namespace, 'commit');
/** The one lock every read-modify-write of the persisted state runs under. */
const stateLockName = (namespace: string) => scopedName(namespace, 'state');
/**
 * Held (shared) by every page for the package it runs. Taken exclusively,
 * when free, to delete the package's cache.
 */
const usingLockName = (namespace: string, version: string) =>
  scopedName(namespace, 'using', version);
/**
 * Held (shared) while resources download and get recorded. Taken
 * exclusively, when free, to prune the resource cache.
 */
const resourceLockName = (namespace: string) =>
  scopedName(namespace, 'resource-downloads');
/** Held (shared) while a tab downloads a package, until it commits or gives up. */
const downloadingLockName = (namespace: string, version: string) =>
  scopedName(namespace, 'downloading', version);

/**
 * `record[key]` if it is the record's own property. Namespaces and file paths
 * are arbitrary strings: "constructor" must not find Object.prototype's.
 */
function ownEntry<T>(
  record: Record<string, T> | undefined,
  key: string
): T | undefined {
  return record !== undefined &&
    Object.prototype.hasOwnProperty.call(record, key)
    ? record[key]
    : undefined;
}

/** A record keyed by arbitrary strings, without inherited properties. */
function emptyRecord<T>(): Record<string, T> {
  return Object.create(null) as Record<string, T>;
}

/** This page's runtime of `namespace`, if it booted. */
function runtimeOf(namespace: string): AirborneWebRuntime | undefined {
  return ownEntry(window.__AIRBORNE__, namespace);
}

/**
 * @internal This page's runtime of `namespace`. Throws when it has not
 * booted. Shared with the web entry; not part of the public API.
 */
export function requireRuntime(namespace: string): AirborneWebRuntime {
  const runtime = runtimeOf(namespace);
  if (!runtime) {
    throw new Error(
      `Airborne has not booted namespace '${namespace}'. Call bootAirborne() from the host page first.`
    );
  }
  return runtime;
}

/**
 * Used for a missing or out-of-range timeout. iOS defaults to 1000 ms as well;
 * Android's defaults are 3000 ms (release config) and 7000 ms (boot).
 */
const DEFAULT_TIMEOUT_MS = 1000;

/**
 * Longest `boot_timeout` / `release_config_timeout` honoured. A value outside
 * (0, MAX_TIMEOUT_MS] is a bad config and gets DEFAULT_TIMEOUT_MS instead: 0
 * would abort every request, and anything past 2^31 - 1 overflows setTimeout,
 * which then fires at once. Either would lock clients out of updates.
 */
const MAX_TIMEOUT_MS = 60_000;

/** Stored with each cached file: the checksum its bytes were verified against. */
const CHECKSUM_HEADER = 'x-airborne-checksum';

/** Query parameter that adds the checksum to a file's cache key (see cacheKey). */
const CHECKSUM_PARAM = 'airborne-sha';

interface PersistedState {
  /** Bundled package version of the host deploy that wrote this state. */
  bundledVersion?: string;
  /** Last package whose important set fully downloaded. */
  current: ReleaseConfig | null;
  /** The last copy of each resource that reached the cache, by file_path. */
  resources?: Record<string, ReleaseFile>;
  guard?: GuardState;
  blocked?: string[];
}

// ---------------------------------------------------------------------------
// Validation: network and persisted JSON are untrusted shapes.

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isReleaseFile(value: unknown): value is ReleaseFile {
  return (
    isObject(value) &&
    typeof value.file_path === 'string' &&
    value.file_path.length > 0 &&
    typeof value.url === 'string' &&
    value.url.length > 0 &&
    (value.checksum === undefined || typeof value.checksum === 'string')
  );
}

function isFileList(value: unknown): value is ReleaseFile[] {
  return Array.isArray(value) && value.every(isReleaseFile);
}

function isReleaseConfig(value: unknown): value is ReleaseConfig {
  if (!isObject(value) || typeof value.version !== 'string') {
    return false;
  }
  const { config, package: pkg, resources } = value;
  return (
    isObject(config) &&
    isFiniteNumber(config.boot_timeout) &&
    isFiniteNumber(config.release_config_timeout) &&
    isObject(pkg) &&
    typeof pkg.version === 'string' &&
    isReleaseFile(pkg.index) &&
    isFileList(pkg.important) &&
    isFileList(pkg.lazy) &&
    isFileList(resources)
  );
}

/** A timeout from a release config, clamped to (0, MAX_TIMEOUT_MS]. */
function sanitizeTimeout(timeoutMs: number): number {
  if (timeoutMs > 0 && timeoutMs <= MAX_TIMEOUT_MS) {
    return timeoutMs;
  }
  return DEFAULT_TIMEOUT_MS;
}

function sanitizeState(value: unknown): PersistedState {
  if (!isObject(value)) {
    return { current: null };
  }
  const state: PersistedState = {
    current: isReleaseConfig(value.current) ? value.current : null,
  };
  if (typeof value.bundledVersion === 'string') {
    state.bundledVersion = value.bundledVersion;
  }
  if (isObject(value.resources)) {
    const resources = emptyRecord<ReleaseFile>();
    for (const [filePath, file] of Object.entries(value.resources)) {
      if (isReleaseFile(file) && file.file_path === filePath) {
        resources[filePath] = file;
      }
    }
    state.resources = resources;
  }
  if (Array.isArray(value.blocked)) { state.blocked = value.blocked.filter((v): v is string => typeof v === "string"); }
  const guard = sanitizeGuard(value.guard);
  if (guard) {
    state.guard = guard;
  }
  return state;
}

// ---------------------------------------------------------------------------
// Persistence. localStorage can be full, blocked or missing; none of that may
// stop the page from booting a bundle.

function readState(namespace: string): PersistedState {
  try {
    const raw = localStorage.getItem(stateKey(namespace));
    if (raw) {
      return sanitizeState(JSON.parse(raw));
    }
  } catch {
    // Corrupt or unreadable state is treated the same as a first launch.
  }
  return { current: null };
}

/** Best effort. Returns whether the state was saved. */
function writeState(namespace: string, state: PersistedState): boolean {
  try {
    localStorage.setItem(stateKey(namespace), JSON.stringify(state));
    return true;
  } catch (error) {
    console.warn('Airborne: could not save state', error);
    return false;
  }
}

/**
 * The only way the persisted state changes. `update` gets a fresh read and
 * returns the next state, or null to leave it as it is. It runs under one
 * exclusive Web Lock per namespace, so that no tab writes back a snapshot read
 * before another tab's change. `update` is synchronous: anything slow (cache
 * reads, lock queries, downloads) happens before, and `update` re-validates
 * what it found. Resolves to whether the state was saved (true when `update`
 * changed nothing).
 */
function updateState(
  namespace: string,
  update: (state: PersistedState) => PersistedState | null
): Promise<boolean> {
  return withExclusiveLock(stateLockName(namespace), async () => {
    const next = update(readState(namespace));
    return next === null ? true : writeState(namespace, next);
  });
}

/**
 * The persisted state as this page may use it. State another host deploy owns
 * (this page's adoption failed to save, or a newer deploy took over while it
 * booted) holds nothing for this page: no package and no resources. With the
 * guard off, a guard left in state (discarding it failed) is ignored too, as
 * is a guard of another host deploy.
 */
function ownState(
  state: PersistedState,
  bundledVersion: string,
  guardEnabled: boolean
): PersistedState {
  if (state.bundledVersion !== bundledVersion) {
    return { current: null, blocked: state.blocked };
  }
  if (!guardEnabled || state.guard?.binary !== bundledVersion) {
    return { ...state, guard: undefined };
  }
  return state;
}

/** Sticky rollout bucket, so a browser stays on one side of a ramp. */
function getToss(namespace: string): string {
  try {
    const existing = localStorage.getItem(tossKey(namespace));
    if (existing !== null) {
      return existing;
    }
  } catch {
    // Unreadable storage: fall through to a fresh, unsaved toss.
  }
  const toss = String(Math.floor(Math.random() * 100));
  try {
    localStorage.setItem(tossKey(namespace), toss);
  } catch {
    // The toss is only sticky when it can be saved.
  }
  return toss;
}

// ---------------------------------------------------------------------------
// Events, delivered through options.onEvent.

function emit(options: AirborneWebOptions, event: AirborneBootEvent): void {
  try {
    options.onEvent?.(event);
  } catch {
    // A faulty listener must not break the boot.
  }
}

/** Reports, through `onEvent`, what goes wrong without stopping a boot. */
class BootReporter {
  private reportedSaveFailure = false;
  private readonly failedDownloads = new Set<string>();

  constructor(private readonly options: AirborneWebOptions) {}

  error(message: string, packageVersion?: string): void {
    emit(
      this.options,
      packageVersion === undefined
        ? { type: 'error', message }
        : { type: 'error', message, packageVersion }
    );
  }

  /**
   * Passes `saved` through. The first failed state write of a boot is
   * reported; storage that is full or blocked stays so for the later ones.
   */
  saved(saved: boolean): boolean {
    if (!saved && !this.reportedSaveFailure) {
      this.reportedSaveFailure = true;
      this.error(
        'Airborne: could not save loader state (storage full or blocked); downloads and the boot guard are not remembered'
      );
    }
    return saved;
  }

  /** A background download of a package's files failed. Reported once per package. */
  downloadFailed(packageVersion: string, error: unknown): void {
    if (this.failedDownloads.has(packageVersion)) {
      return;
    }
    this.failedDownloads.add(packageVersion);
    this.error(
      `Airborne: download of package ${packageVersion} failed: ${String(error)}`,
      packageVersion
    );
  }
}

// ---------------------------------------------------------------------------
// Background work. The boot never waits for it; tests do, through __testing.

const backgroundWork = new Set<Promise<void>>();

/**
 * Lets `work` run on after the boot. Failures are dropped here: the work that
 * matters (package downloads) reports its own through the BootReporter.
 */
function inBackground(work: Promise<unknown>): Promise<void> {
  const settled = work.then(
    () => {},
    () => {}
  );
  backgroundWork.add(settled);
  settled.then(() => backgroundWork.delete(settled));
  return settled;
}

// ---------------------------------------------------------------------------
// Network and Cache Storage.

function formatDimensions(dimensions: Record<string, string>): string {
  return Object.keys(dimensions)
    .sort()
    .map((key) => `${key}=${dimensions[key]};`)
    .join('');
}

async function fetchReleaseConfig(
  options: AirborneWebOptions,
  timeoutMs: number
): Promise<ReleaseConfig | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const url = new URL(options.releaseConfigUrl);
    if (options.telemetryEnabled) { url.searchParams.set('telemetry_platform', 'web'); url.searchParams.set('native_version', options.nativeVersion ?? options.dimensions?.app_version ?? 'unknown'); }
    url.searchParams.set('toss', getToss(options.namespace));
    const headers: Record<string, string> = {};
    if (options.dimensions && Object.keys(options.dimensions).length > 0) {
      headers['x-dimension'] = formatDimensions(options.dimensions);
    }
    const response = await fetch(url.toString(), {
      headers,
      signal: controller.signal,
      cache: 'no-store',
    });
    if (!response.ok) {
      return null;
    }
    const body: unknown = await response.json();
    return isReleaseConfig(body) ? body : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Whether the release lists a checksum for `file`. A downloaded file without
 * one is never cached, reused or run. The page's own bundled files are exempt:
 * they are deployed with the page and never pass through here.
 */
function hasChecksum(file: ReleaseFile): boolean {
  return typeof file.checksum === 'string' && file.checksum.length > 0;
}

/** A file the release lists without a checksum, which cannot be verified. */
class MissingChecksumError extends Error {
  constructor(readonly filePath: string) {
    super(
      `Airborne: refusing ${filePath}: the release lists no SHA-256 checksum for it`
    );
  }
}

async function matchesChecksum(
  bytes: ArrayBuffer,
  checksum?: string
): Promise<boolean> {
  if (!checksum) {
    return false;
  }
  // crypto.subtle only exists on secure origins. A file that cannot be
  // verified is treated as corrupt rather than run unchecked.
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    return false;
  }
  const digest = new Uint8Array(await subtle.digest('SHA-256', bytes));
  const hex = Array.from(digest, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  const base64 = btoa(String.fromCharCode(...digest));
  return checksum === hex || checksum === base64;
}

/**
 * The cached bytes of `file`, verified against its checksum, or null. An entry
 * that was stored as this file but no longer matches it is corrupt and is
 * deleted, so the next download fetches it again.
 */
async function readCachedFile(
  cache: Cache,
  file: ReleaseFile
): Promise<Blob | null> {
  if (!hasChecksum(file)) {
    return null;
  }
  const response = await cache.match(cacheKey(file));
  if (!response) {
    return null;
  }
  const blob = await response.blob();
  if (await matchesChecksum(await blob.arrayBuffer(), file.checksum)) {
    return blob;
  }
  if (response.headers.get(CHECKSUM_HEADER) === file.checksum) {
    await cache.delete(cacheKey(file));
  }
  return null;
}

/**
 * Whether the cache already holds the bytes this release asks for: content
 * republished at the same URL comes with a new checksum. The checksum stored
 * with the entry answers that without hashing the file again.
 */
async function isCached(cache: Cache, file: ReleaseFile): Promise<boolean> {
  // Never by URL alone: without a checksum there is nothing to say the cached
  // bytes are the ones the release means.
  if (!hasChecksum(file)) {
    return false;
  }
  const response = await cache.match(cacheKey(file));
  return response?.headers.get(CHECKSUM_HEADER) === file.checksum;
}

async function downloadFile(cache: Cache, file: ReleaseFile): Promise<void> {
  if (!hasChecksum(file)) {
    throw new MissingChecksumError(file.file_path);
  }
  if (await isCached(cache, file)) {
    return;
  }
  const response = await fetch(file.url, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Airborne: ${file.file_path} -> ${response.status}`);
  }
  const bytes = await response.arrayBuffer();
  if (!(await matchesChecksum(bytes, file.checksum))) {
    throw new Error(`Airborne: checksum mismatch for ${file.file_path}`);
  }
  const headers = new Headers();
  const contentType = response.headers.get('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }
  headers.set(CHECKSUM_HEADER, file.checksum as string);
  await cache.put(cacheKey(file), new Response(bytes, { headers }));
}

/**
 * The cache key of `file`: its absolute URL, plus its checksum when it has
 * one. Content republished at the same URL then never shares an entry with
 * the older bytes, which a slower download finishing last would otherwise
 * write over the newer ones. A query parameter, not a fragment: cache
 * matching ignores fragments. The network request still uses `file.url`.
 */
function cacheKey(file: ReleaseFile): string {
  if (!file.checksum) {
    return absoluteUrl(file.url);
  }
  try {
    const url = new URL(file.url, location.href);
    url.searchParams.append(CHECKSUM_PARAM, file.checksum);
    return url.toString();
  } catch {
    return file.url;
  }
}

function requiredFiles(releaseConfig: ReleaseConfig): ReleaseFile[] {
  const { package: pkg } = releaseConfig;
  return [pkg.index, ...pkg.important];
}

/** The index and important files of `releaseConfig` that list no checksum. */
function unverifiableRequiredFiles(
  releaseConfig: ReleaseConfig
): ReleaseFile[] {
  return requiredFiles(releaseConfig).filter((file) => !hasChecksum(file));
}

/** Opens a cache without creating it when it does not exist. */
async function openExistingCache(cacheName: string): Promise<Cache | null> {
  return (await caches.has(cacheName)) ? caches.open(cacheName) : null;
}

/** Whether the index and every important file are present in the package cache. */
async function hasPackageFiles(
  namespace: string,
  releaseConfig: ReleaseConfig
): Promise<boolean> {
  try {
    const cache = await openExistingCache(
      packageCacheName(namespace, releaseConfig.package.version)
    );
    if (!cache) {
      return false;
    }
    const present = await Promise.all(
      requiredFiles(releaseConfig).map((file) => cache.match(cacheKey(file)))
    );
    return present.every(Boolean);
  } catch {
    return false;
  }
}

function navigatorLocks(): LockManager | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.locks;
}

/**
 * Runs `work` while holding a cross-tab lock, when the browser has them. A
 * lock manager that fails before `work` starts is treated as missing.
 */
async function withLock<T>(
  name: string,
  mode: LockMode,
  work: () => Promise<T>
): Promise<T> {
  const locks = navigatorLocks();
  if (!locks) {
    return work();
  }
  let started = false;
  try {
    return await locks.request(name, { mode }, () => {
      started = true;
      return work();
    });
  } catch (error) {
    if (started) {
      throw error;
    }
    return work();
  }
}

function withExclusiveLock<T>(
  name: string,
  work: () => Promise<T>
): Promise<T> {
  return withLock(name, 'exclusive', work);
}

/**
 * Runs `work` only if the exclusive lock `name` is free right now, holding it
 * meanwhile. Without Web Locks it just runs. A failing lock manager runs
 * nothing: `work` is a deletion, and skipping one only keeps files longer.
 */
async function ifLockFree(name: string, work: () => Promise<void>) {
  const locks = navigatorLocks();
  if (!locks) {
    await work();
    return;
  }
  await locks
    .request(name, { ifAvailable: true }, async (lock) => {
      if (lock) {
        await work();
      }
    })
    .catch(() => {});
}

/** Takes a shared lock and resolves, once it is granted, to its release. */
function holdSharedLock(locks: LockManager, name: string): Promise<() => void> {
  return new Promise((granted) => {
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    locks
      .request(name, { mode: 'shared' }, () => {
        granted(release);
        return held;
      })
      .catch(() => granted(() => {}));
  });
}

/**
 * This page's hold on the package it runs, per namespace. Other tabs do not
 * prune a package that any page holds (see pruneCaches): its lazy files and
 * blob sources stay readable. The browser releases it when the page goes.
 */
const packageHolds = new Map<string, () => void>();

/** Holds the `using` lock of `version`. A no-op without Web Locks. */
async function holdPackage(
  namespace: string,
  version: string
): Promise<() => void> {
  const locks = navigatorLocks();
  if (!locks) {
    return () => {};
  }
  return holdSharedLock(locks, usingLockName(namespace, version));
}

/** Records the hold of the package now running (null: none), releasing the previous one. */
function keepPackageHold(namespace: string, hold: (() => void) | null): void {
  const previous = packageHolds.get(namespace);
  if (hold) {
    packageHolds.set(namespace, hold);
  } else {
    packageHolds.delete(namespace);
  }
  if (previous && previous !== hold) {
    previous();
  }
}

function commitPackage(
  state: PersistedState,
  releaseConfig: ReleaseConfig
): PersistedState {
  return {
    ...state,
    current: releaseConfig,
    guard: liftBlock(state.guard, releaseConfig.package.version),
  };
}

/**
 * A download whose commit no longer applies: the state now belongs to another
 * host deploy (or, with storage failing, never belonged to this one), or
 * another tab committed a different package since the download started.
 * Expected, so not reported.
 */
class StaleDownloadError extends Error {}

/**
 * Atomic: state only moves once every important file is in the cache. Nothing
 * is committed if the host page was redeployed (`bundledVersion` changed)
 * while the package downloaded: it belongs to the older deploy.
 */
async function downloadPackage(
  namespace: string,
  releaseConfig: ReleaseConfig,
  bundledVersion: string,
  reporter: BootReporter
): Promise<void> {
  const { package: pkg } = releaseConfig;
  // What was committed when this download started. A different package
  // committed by the time it lands is newer than this one.
  const committedAtStart = readState(namespace).current?.package.version;
  try {
    // Shared until committed or given up, so that no tab deletes the cache
    // while this tab fills it (see deletePackageCache).
    await withLock(
      downloadingLockName(namespace, pkg.version),
      'shared',
      async () => {
        const cache = await caches.open(
          packageCacheName(namespace, pkg.version)
        );
        const downloads = await Promise.allSettled(
          requiredFiles(releaseConfig).map((file) => downloadFile(cache, file))
        );
        const failure = downloads.find(
          (download) => download.status === 'rejected'
        );
        if (failure) {
          throw failure.reason;
        }
        await commitDownload(
          namespace,
          releaseConfig,
          bundledVersion,
          committedAtStart,
          reporter
        );
      }
    );
  } catch (error) {
    await discardPartialPackage(namespace, pkg.version).catch(() => {});
    throw error;
  }
}

/** Commits a downloaded package, unless the download is stale by now. */
async function commitDownload(
  namespace: string,
  releaseConfig: ReleaseConfig,
  bundledVersion: string,
  committedAtStart: string | undefined,
  reporter: BootReporter
): Promise<void> {
  const { package: pkg } = releaseConfig;
  await withExclusiveLock(commitLockName(namespace), async () => {
    // Another tab may have pruned this cache while the files downloaded,
    // which leaves our Cache object detached. Re-open it by name to check.
    if (!(await hasPackageFiles(namespace, releaseConfig))) {
      throw new Error(
        `Airborne: package ${pkg.version} lost files before commit`
      );
    }
    // Checked in the same locked update as the commit: a newer deploy
    // adopted, or another package committed, at any point before it wins.
    let stale: string | undefined;
    const saved = await updateState(namespace, (state) => {
      const current = state.current?.package.version;
      if (state.bundledVersion !== bundledVersion) {
        stale = 'was downloaded for an older host deploy';
        return null;
      }
      if (current !== committedAtStart && current !== pkg.version) {
        stale = `was superseded by package ${current} while it downloaded`;
        return null;
      }
      return commitPackage(state, releaseConfig);
    });
    if (stale !== undefined) {
      throw new StaleDownloadError(`Airborne: package ${pkg.version} ${stale}`);
    }
    if (reporter.saved(saved)) {
      await pruneCaches(namespace);
    }
  });
}

/** Package versions whose caches must survive pruning. */
function keptPackageVersions(state: PersistedState): Set<string> {
  const versions = new Set<string>();
  if (state.current) {
    versions.add(state.current.package.version);
  }
  const lastGood = state.guard?.lastGood;
  if (lastGood) {
    versions.add(lastGood.package.version);
  }
  return versions;
}

/**
 * Deletes a package's cache unless a tab is downloading it (its `downloading`
 * lock) or an open page holds it (its `using` lock). Both are taken
 * exclusively across the deletion: a tab that starts either meanwhile waits,
 * then finds no cache (downloads start over; a boot picks another package).
 */
function deletePackageCache(namespace: string, version: string) {
  return ifLockFree(downloadingLockName(namespace, version), () =>
    ifLockFree(usingLockName(namespace, version), async () => {
      await caches.delete(packageCacheName(namespace, version));
    })
  );
}

/** Deletes the cache of a package that failed to download, unless it is still used. */
async function discardPartialPackage(
  namespace: string,
  version: string
): Promise<void> {
  await withExclusiveLock(commitLockName(namespace), async () => {
    if (!keptPackageVersions(readState(namespace)).has(version)) {
      await deletePackageCache(namespace, version);
    }
  });
}

/**
 * Deletes the caches of packages that state does not refer to and no open
 * page runs. Runs under the commit lock, so that no commit lands between the
 * check and the delete.
 */
async function pruneCaches(namespace: string): Promise<void> {
  const kept = keptPackageVersions(readState(namespace));
  const prefix = packageCacheName(namespace, '');
  const names = await caches.keys();
  await Promise.all(
    names
      .filter((name) => name.startsWith(prefix))
      .map((name) => decodeURIComponent(name.slice(prefix.length)))
      .filter((version) => !kept.has(version))
      .map((version) => deletePackageCache(namespace, version))
  );
}

/**
 * Packages and resources cached under an older host deploy must never run
 * over the files a newer deploy ships with (an offline launch would otherwise
 * boot the older cached package). A new bundled package version drops them,
 * and the guard state with them.
 */
async function adoptHostDeploy(
  namespace: string,
  bundledVersion: string,
  reporter: BootReporter
): Promise<void> {
  if (readState(namespace).bundledVersion === bundledVersion) {
    return;
  }
  let adopted = false;
  const saved = await updateState(namespace, (state) => {
    // Another tab of this deploy may have adopted it meanwhile.
    if (state.bundledVersion === bundledVersion) {
      return null;
    }
    adopted = true;
    return { current: null, bundledVersion, blocked: state.blocked };
  });
  if (!reporter.saved(saved) || !adopted) {
    return;
  }
  await withExclusiveLock(commitLockName(namespace), () =>
    pruneCaches(namespace)
  ).catch(() => {});
}

function absoluteUrl(url: string): string {
  try {
    return new URL(url, location.href).toString();
  } catch {
    return url;
  }
}

/**
 * Every file is independent; a failed or slow one keeps serving the copy that
 * was cached before. `onCached` hears about each file as it lands.
 */
async function downloadResources(
  namespace: string,
  release: ReleaseConfig,
  bundledVersion: string,
  reporter: BootReporter,
  onCached: (cacheName: string, file: ReleaseFile) => void
): Promise<void> {
  const { resources } = release;
  const cacheName = resourceCacheName(namespace);
  // The release in state when the downloads started. If another one is in
  // state by the time they land, its resources are newer than these.
  const currentAtStart = releaseKey(readState(namespace).current);
  // Shared from the first download until the files are recorded: until then
  // a cached file is in no state, and a prune would take it for stale.
  const recorded = await withLock(
    resourceLockName(namespace),
    'shared',
    async () => {
      const cache = await caches.open(cacheName);
      const cached: ReleaseFile[] = [];
      const downloads = await Promise.allSettled(
        resources.map(async (file) => {
          await downloadFile(cache, file);
          cached.push(file);
          onCached(cacheName, file);
        })
      );
      // Other failures keep the previous copy silently. A resource that the
      // release lists without a checksum is refused for good, so say so.
      const refused = downloads.flatMap((download) =>
        download.status === 'rejected' &&
        download.reason instanceof MissingChecksumError
          ? [download.reason.filePath]
          : []
      );
      if (refused.length > 0) {
        reporter.error(
          `Airborne: not using resource(s) ${refused.join(', ')} of package ${release.package.version}: no SHA-256 checksum`,
          release.package.version
        );
      }
      return recordResources(
        namespace,
        release,
        cached,
        bundledVersion,
        currentAtStart,
        reporter
      );
    }
  );
  if (recorded) {
    await pruneResources(namespace);
  }
}

/** Identifies a release: its package version and config version. */
function releaseKey(release: ReleaseConfig | null): string | null {
  return release === null
    ? null
    : JSON.stringify([release.package.version, release.config.version]);
}

/**
 * Records the resources that just landed in one state write, and drops the
 * records of file_paths the release no longer lists. Records nothing for a
 * page from an older host deploy (`bundledVersion` changed), nor when another
 * tab put a different release in state since the downloads started (its
 * resources are newer). Resolves to whether the record was saved.
 */
async function recordResources(
  namespace: string,
  release: ReleaseConfig,
  cached: ReleaseFile[],
  bundledVersion: string,
  currentAtStart: string | null,
  reporter: BootReporter
): Promise<boolean> {
  const listed = new Set(release.resources.map((file) => file.file_path));
  const own = releaseKey(release);
  let recorded = false;
  const saved = await updateState(namespace, (state) => {
    if (state.bundledVersion !== bundledVersion) {
      return null;
    }
    const current = releaseKey(state.current);
    if (current !== currentAtStart && current !== own) {
      return null;
    }
    const next = emptyRecord<ReleaseFile>();
    for (const [filePath, file] of Object.entries(state.resources ?? {})) {
      if (listed.has(filePath)) {
        next[filePath] = file;
      }
    }
    cached.forEach((file) => {
      next[file.file_path] = file;
    });
    recorded = true;
    return { ...state, resources: next };
  });
  return reporter.saved(saved) && recorded;
}

/**
 * Deletes cached resources that the state, read fresh, no longer names. Only
 * while no tab is downloading or recording resources (they hold the resource
 * lock shared); otherwise a later boot prunes instead.
 */
function pruneResources(namespace: string): Promise<void> {
  return ifLockFree(resourceLockName(namespace), async () => {
    const cache = await openExistingCache(resourceCacheName(namespace));
    if (!cache) {
      return;
    }
    const named = new Set(
      Object.values(readState(namespace).resources ?? {}).map(cacheKey)
    );
    const requests = await cache.keys();
    await Promise.all(
      requests
        .filter((request) => !named.has(absoluteUrl(request.url)))
        .map((request) => cache.delete(request))
    );
  });
}

async function downloadLazy(
  namespace: string,
  releaseConfig: ReleaseConfig,
  live: LiveRuntime,
  reporter: BootReporter
): Promise<void> {
  const { package: pkg } = releaseConfig;
  const cacheName = packageCacheName(namespace, pkg.version);
  const cache = await caches.open(cacheName);
  const downloads = await Promise.allSettled(
    pkg.lazy.map(async (file) => {
      await downloadFile(cache, file);
      // Publish only into the package these files belong to.
      live.publish(cacheName, file, (runtime) => {
        return (
          runtime.source === 'ota' &&
          runtime.releaseConfig.package.version === pkg.version
        );
      });
    })
  );
  const failure = downloads.find((download) => download.status === 'rejected');
  if (failure) {
    reporter.downloadFailed(pkg.version, failure.reason);
  }
}

function raceTimeout<T>(work: Promise<T>, timeoutMs: number) {
  return new Promise<'done' | 'timeout' | 'failed'>((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);
    work.then(
      () => {
        clearTimeout(timer);
        resolve('done');
      },
      () => {
        clearTimeout(timer);
        resolve('failed');
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Runtime file maps and their blob URLs.

/**
 * For each runtime, the cache entry (cache name, URL and checksum) behind
 * every file_path that is served from a blob URL. Lets us reuse a blob URL for
 * the same entry and revoke the ones we replace.
 */
const blobEntries = new WeakMap<AirborneWebRuntime, Map<string, string>>();

/** Runtimes replaced by a later boot; publishing into them would leak blob URLs. */
const retiredRuntimes = new WeakSet<AirborneWebRuntime>();

function blobEntriesOf(runtime: AirborneWebRuntime): Map<string, string> {
  let entries = blobEntries.get(runtime);
  if (!entries) {
    entries = new Map();
    blobEntries.set(runtime, entries);
  }
  return entries;
}

/** Content republished at the same URL is a different entry: its checksum differs. */
function entryKey(cacheName: string, file: ReleaseFile): string {
  return `${cacheName} ${file.url} ${file.checksum ?? ''}`;
}

function setBlobFile(
  runtime: AirborneWebRuntime,
  filePath: string,
  blob: Blob,
  entry: string
): void {
  if (retiredRuntimes.has(runtime)) {
    return;
  }
  const entries = blobEntriesOf(runtime);
  const previous = ownEntry(runtime.files, filePath);
  if (previous !== undefined && entries.has(filePath)) {
    URL.revokeObjectURL(previous);
  }
  runtime.files[filePath] = URL.createObjectURL(blob);
  entries.set(filePath, entry);
}

/** Points `file.file_path` at the cached copy of `file`. False when it is not cached. */
async function publishCachedFile(
  runtime: AirborneWebRuntime,
  cacheName: string,
  file: ReleaseFile
): Promise<boolean> {
  const entry = entryKey(cacheName, file);
  const entries = blobEntriesOf(runtime);
  if (entries.get(file.file_path) === entry) {
    return true;
  }
  const cache = await openExistingCache(cacheName);
  const blob = cache ? await readCachedFile(cache, file) : null;
  if (!blob) {
    return false;
  }
  // Another publish of the same entry may have finished while we read.
  if (entries.get(file.file_path) !== entry) {
    setBlobFile(runtime, file.file_path, blob, entry);
  }
  return true;
}

function revokeRuntime(runtime: AirborneWebRuntime): void {
  retiredRuntimes.add(runtime);
  const entries = blobEntries.get(runtime);
  entries?.forEach((_entry, filePath) => {
    const url = runtime.files[filePath];
    if (url !== undefined) {
      URL.revokeObjectURL(url);
    }
  });
  blobEntries.delete(runtime);
  if (runtime.source === 'ota') {
    URL.revokeObjectURL(runtime.bundlePath);
  }
}

/**
 * The runtime of the current boot, once it is published. Downloads that finish
 * before then are queued and replayed onto it, so none of them are lost.
 */
class LiveRuntime {
  private runtime: AirborneWebRuntime | null = null;
  private queued: Array<() => void> = [];

  constructor(private readonly namespace: string) {}

  publish(
    cacheName: string,
    file: ReleaseFile,
    accepts: (runtime: AirborneWebRuntime) => boolean = () => true
  ): void {
    const run = () => {
      const runtime = this.runtime;
      // A later bootAirborne() call owns the page now.
      if (!runtime || runtimeOf(this.namespace) !== runtime) {
        return;
      }
      if (accepts(runtime)) {
        inBackground(publishCachedFile(runtime, cacheName, file));
      }
    };
    if (this.runtime) {
      run();
    } else {
      this.queued.push(run);
    }
  }

  attach(runtime: AirborneWebRuntime): void {
    // A runtime replaced before its files were published (its bundle failed
    // to run) leaves the queue to its replacement.
    if (retiredRuntimes.has(runtime)) {
      return;
    }
    this.runtime = runtime;
    const queued = this.queued;
    this.queued = [];
    queued.forEach((run) => run());
  }
}

function bundledUrl(options: AirborneWebOptions, file: ReleaseFile): string {
  const base = new URL(options.bundled.baseUrl, location.href);
  return new URL(file.file_path, base).toString();
}

/** URLs of files deployed with the host page, by file_path. */
function bundledUrls(
  options: AirborneWebOptions,
  files: ReleaseFile[]
): Record<string, string> {
  const urls = emptyRecord<string>();
  files.forEach((file) => {
    urls[file.file_path] = bundledUrl(options, file);
  });
  return urls;
}

/**
 * The files deployed with the host page. `overlay`, a newer release config of
 * the bundled package (or one whose package did not make it), supplies the
 * config; its resources are published over the bundled ones.
 */
function bundledRuntime(
  options: AirborneWebOptions,
  overlay: ReleaseConfig | null
): AirborneWebRuntime {
  const bundled = options.bundled.releaseConfig;
  const pkg = bundled.package;
  const releaseConfig = overlay
    ? { ...bundled, config: overlay.config }
    : bundled;
  return {
    source: 'bundled',
    releaseConfig,
    bundlePath: bundledUrl(options, pkg.index),
    files: bundledUrls(options, [
      ...pkg.important,
      ...pkg.lazy,
      ...bundled.resources,
    ]),
  };
}

/**
 * The cached package: its index and important files, over the bundled
 * resources. Bundled package files are not inherited, since they belong to
 * another version; lazy files are published once cached. Null, and the
 * corrupt entries deleted so the next boot downloads them again, unless the
 * index and every important file are cached and match their checksums.
 */
async function otaRuntime(
  namespace: string,
  releaseConfig: ReleaseConfig,
  bundledResources: Record<string, string>
): Promise<AirborneWebRuntime | null> {
  const pkg = releaseConfig.package;
  const cacheName = packageCacheName(namespace, pkg.version);
  const cache = await openExistingCache(cacheName);
  if (!cache) {
    return null;
  }
  const required = requiredFiles(releaseConfig);
  const blobs = await Promise.all(
    required.map((file) => readCachedFile(cache, file))
  );
  const broken = required.filter((_file, index) => !blobs[index]);
  if (broken.length > 0) {
    await Promise.all(broken.map((file) => cache.delete(cacheKey(file))));
    return null;
  }
  const [indexBlob, ...importantBlobs] = blobs as Blob[];
  const runtime: AirborneWebRuntime = {
    source: 'ota',
    releaseConfig,
    bundlePath: URL.createObjectURL(indexBlob as Blob),
    files: Object.assign(emptyRecord<string>(), bundledResources),
  };
  pkg.important.forEach((file, index) => {
    const blob = importantBlobs[index] as Blob;
    setBlobFile(runtime, file.file_path, blob, entryKey(cacheName, file));
  });
  return runtime;
}

/** Serves each resource from its latest cached copy, else the one cached before. */
/**
 * Whether `filePath` is a file of the package `runtime` runs (index,
 * important or lazy). A resource never replaces one: the package's own,
 * verified copy stays.
 */
function isPackageFile(runtime: AirborneWebRuntime, filePath: string): boolean {
  const pkg = runtime.releaseConfig.package;
  return [pkg.index, ...pkg.important, ...pkg.lazy].some(
    (file) => file.file_path === filePath
  );
}

async function overlayResources(
  namespace: string,
  runtime: AirborneWebRuntime,
  resources: ReleaseFile[],
  previous: Record<string, ReleaseFile>
): Promise<void> {
  const cacheName = resourceCacheName(namespace);
  await Promise.all(
    resources.map(async (file) => {
      if (isPackageFile(runtime, file.file_path)) {
        return;
      }
      if (await publishCachedFile(runtime, cacheName, file)) {
        return;
      }
      const fallback = ownEntry(previous, file.file_path);
      if (fallback) {
        await publishCachedFile(runtime, cacheName, fallback);
      }
    })
  );
}

/**
 * Publishes what was cached before this boot but is not needed to start the
 * bundle: the package's lazy files and the resources. It runs alongside the
 * bundle, so readers wait for it through `runtime.ready`.
 */
async function publishCachedFiles(
  namespace: string,
  runtime: AirborneWebRuntime,
  resources: ReleaseFile[],
  previousResources: Record<string, ReleaseFile>
): Promise<void> {
  const work: Array<Promise<unknown>> = [
    overlayResources(namespace, runtime, resources, previousResources),
  ];
  if (runtime.source === 'ota') {
    const pkg = runtime.releaseConfig.package;
    const cacheName = packageCacheName(namespace, pkg.version);
    pkg.lazy.forEach((file) => {
      work.push(publishCachedFile(runtime, cacheName, file));
    });
  }
  await Promise.allSettled(work);
}

/** Replaces the namespace's runtime, releasing the blob URLs of the old one. */
function installRuntime(namespace: string, runtime: AirborneWebRuntime): void {
  window.__AIRBORNE__ = window.__AIRBORNE__ ?? emptyRecord();
  const previous = runtimeOf(namespace);
  if (previous && previous !== runtime) {
    revokeRuntime(previous);
  }
  window.__AIRBORNE__[namespace] = runtime;
}

function injectScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Airborne: failed to run ${src}`));
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Boot guard (opt-in). Rolls back packages that keep booting without ever
// reaching markBootSuccess().

/** Unacknowledged boots before a package is blocked. Web, Android and iOS must agree. */
const MAX_UNACKNOWLEDGED_BOOTS = 2;

/**
 * How long a tab's boot keeps other tabs from counting a boot of the same
 * package (see joinBoot). Ample for a healthy bundle to reach
 * markBootSuccess(); after it, a tab left open on a blank or crashed page no
 * longer suppresses counting. Acknowledging later still works.
 */
const BOOT_WINDOW_MS = 30_000;

const guardLockName = (namespace: string) => `airborne:${namespace}:guard`;
const bootingLockName = (namespace: string, version: string) =>
  `airborne:${namespace}:booting:${version}`;

/**
 * Window property holding this page's unacknowledged boot per namespace. The
 * host page and the OTA bundle each carry their own copy of this module, so
 * the session lives on the window where both copies find it.
 */
const BOOT_SESSIONS_KEY = '__AIRBORNE_BOOT__';

interface GuardState {
  /** The host deploy (bundled package version) this state belongs to. */
  binary: string;
  /** Package version booted and not yet acknowledged. */
  pending?: string;
  /** Unacknowledged boots of `pending`. */
  attempts: number;
  /** Package version that must not boot. */
  blocked?: string;
  /** Release config of the package last acknowledged by markBootSuccess. */
  lastGood?: ReleaseConfig;
}

/**
 * Shared between module copies that may come from different SDK releases, so
 * the behaviour sits in closures made by the copy that booted, and the shape
 * stays minimal.
 */
interface BootSession {
  /** Package version this page booted. */
  version: string;
  /**
   * Ends the session and records the acknowledgement. Copies from older SDK
   * releases return nothing.
   */
  acknowledge: () => Promise<void> | void;
  /** Ends the session without acknowledging. Idempotent. */
  end: () => void;
}

/** This page's boot sessions, if any boot was tracked. */
function existingBootSessions(): Record<string, BootSession> | undefined {
  const host = window as unknown as Record<
    string,
    Record<string, BootSession> | undefined
  >;
  return host[BOOT_SESSIONS_KEY];
}

function bootSessions(): Record<string, BootSession> {
  const existing = existingBootSessions();
  if (existing) {
    return existing;
  }
  const sessions = emptyRecord<BootSession>();
  Object.defineProperty(window, BOOT_SESSIONS_KEY, {
    value: sessions,
    configurable: true,
    enumerable: false,
    writable: false,
  });
  return sessions;
}

/** This page's unacknowledged boot of `namespace`, if any. */
function bootSessionOf(namespace: string): BootSession | undefined {
  return ownEntry(existingBootSessions(), namespace);
}

/** Forgets this page's earlier boot of the namespace, if any. */
function endBootSession(namespace: string): void {
  bootSessionOf(namespace)?.end();
}

function sanitizeGuard(value: unknown): GuardState | undefined {
  if (!isObject(value) || typeof value.binary !== 'string') {
    return undefined;
  }
  const guard: GuardState = {
    binary: value.binary,
    attempts: isFiniteNumber(value.attempts) ? value.attempts : 0,
  };
  if (typeof value.pending === 'string') {
    guard.pending = value.pending;
  }
  if (typeof value.blocked === 'string') {
    guard.blocked = value.blocked;
  }
  if (isReleaseConfig(value.lastGood)) {
    guard.lastGood = value.lastGood;
  }
  return guard;
}

/** A newly installed package that is not the blocked one lifts the block. */
function liftBlock(
  guard: GuardState | undefined,
  installedVersion: string
): GuardState | undefined {
  if (!guard?.blocked || guard.blocked === installedVersion) {
    return guard;
  }
  return { ...guard, blocked: undefined };
}

/** Too many unacknowledged boots of `pending`: block it. */
function rollBack(guard: GuardState): GuardState {
  const failed = guard.pending;
  const next: GuardState = { ...guard, pending: undefined, attempts: 0 };
  if (failed !== undefined && failed === guard.lastGood?.package.version) {
    // The fallback itself failed. Dropping it sends the next boot to the
    // bundled package instead of bouncing between two broken ones.
    next.lastGood = undefined;
    next.blocked = guard.blocked ?? failed;
  } else {
    next.blocked = failed;
  }
  return next;
}

async function isLockHeld(locks: LockManager, name: string): Promise<boolean> {
  const snapshot = await locks.query();
  return (snapshot.held ?? []).some((lock) => lock.name === name);
}

/** Whether this page or another live tab is still inside a boot of `version`. */
async function isBooting(namespace: string, version: string): Promise<boolean> {
  if (bootSessionOf(namespace)?.version === version) {
    return true;
  }
  const locks = navigatorLocks();
  if (!locks) {
    return false;
  }
  try {
    return await isLockHeld(locks, bootingLockName(namespace, version));
  } catch {
    return false;
  }
}

function hasTooManyAttempts(guard: GuardState): boolean {
  return (
    guard.pending !== undefined && guard.attempts >= MAX_UNACKNOWLEDGED_BOOTS
  );
}

/**
 * Loads the guard state for this boot. State from another host deploy is
 * dropped, and a package with too many unacknowledged boots is blocked, unless
 * a boot of it is still live and may yet acknowledge it: then the rollback
 * waits for a later launch.
 */
async function openBootGuard(
  options: AirborneWebOptions,
  reporter: BootReporter
): Promise<void> {
  const { namespace } = options;
  const binary = options.bundled.releaseConfig.package.version;
  const guardOf = (state: PersistedState): GuardState =>
    state.guard?.binary === binary ? state.guard : { binary, attempts: 0 };
  const rolledBack = await withExclusiveLock(
    guardLockName(namespace),
    async () => {
      const before = guardOf(readState(namespace));
      const failed = before.pending;
      let rollBackDue = false;
      if (failed !== undefined && hasTooManyAttempts(before)) {
        rollBackDue = !(await isBooting(namespace, failed));
      }
      // A commit, a resource update or an acknowledgement may have landed
      // meanwhile: decide on the fresh state, and change only the guard.
      let rollBackNow = false;
      const saved = await updateState(namespace, (state) => {
        // Another host deploy took over meanwhile: its guard is not ours.
        if (state.bundledVersion !== binary) {
          return null;
        }
        let guard = guardOf(state);
        rollBackNow =
          rollBackDue && guard.pending === failed && hasTooManyAttempts(guard);
        if (rollBackNow) {
          guard = rollBack(guard);
        }
        return { ...state, guard };
      });
      return reporter.saved(saved) && rollBackNow ? failed : undefined;
    }
  );
  if (rolledBack !== undefined) {
    emit(options, { type: 'rollback', packageVersion: rolledBack });
    const failed = readState(options.namespace).current;
    if (failed?.package.version === rolledBack) event(options.namespace, failed, 'rollback');
  }
}

/** With the guard off, leftover state must not block anything if it is re-enabled. */
async function discardBootGuard(
  namespace: string,
  bundledVersion: string,
  reporter: BootReporter
): Promise<void> {
  const saved = await updateState(namespace, (state) =>
    state.guard && state.bundledVersion === bundledVersion
      ? { ...state, guard: undefined }
      : null
  );
  reporter.saved(saved);
}

/** The package to boot, substituting lastGood (or nothing) for a blocked one. */
function selectPackage(state: PersistedState): ReleaseConfig | null {
  const { current, guard } = state;
  const denied = (release: ReleaseConfig) => state.blocked?.includes(release.package.version) || guard?.blocked === release.package.version;
  if (!current || !denied(current)) return current;
  const lastGood = guard?.lastGood;
  return lastGood && !denied(lastGood) ? lastGood : null;
}

/**
 * Takes this tab's shared `booting` lock for `version` and, still inside the
 * guard lock, calls `count` with whether another live tab was already booting
 * it (then this boot is the same attempt and must not count against the
 * release). Resolves to the release of the booting lock.
 */
async function joinBoot(
  namespace: string,
  version: string,
  count: (othersBooting: boolean) => Promise<void>
): Promise<() => void> {
  const locks = navigatorLocks();
  if (!locks) {
    await count(false);
    return () => {};
  }
  const name = bootingLockName(namespace, version);
  let counted = false;
  try {
    return await locks.request(guardLockName(namespace), async () => {
      const othersBooting = await isLockHeld(locks, name);
      const release = await holdSharedLock(locks, name);
      counted = true;
      await count(othersBooting);
      return release;
    });
  } catch {
    if (!counted) {
      await count(false);
    }
    return () => {};
  }
}

/** Counts an OTA boot right before its bundle runs. */
async function trackBoot(
  options: AirborneWebOptions,
  releaseConfig: ReleaseConfig,
  reporter: BootReporter
): Promise<void> {
  const { namespace } = options;
  const version = releaseConfig.package.version;
  const sessions = bootSessions();
  // Native counts once per process: booting the same package again in this
  // page is the same attempt.
  if (ownEntry(sessions, namespace)?.version === version) {
    return;
  }
  endBootSession(namespace);
  const binary = options.bundled.releaseConfig.package.version;
  const release = await joinBoot(namespace, version, async (othersBooting) => {
    const saved = await updateState(namespace, (state) => {
      const guard = state.guard ?? { binary, attempts: 0 };
      // Nothing is counted into another host deploy's state.
      if (state.bundledVersion !== binary || guard.binary !== binary) {
        return null;
      }
      // Blocked by another tab since this one selected it: the block stands,
      // and is not to be undone by an acknowledgement either.
      if (guard.blocked === version) {
        return null;
      }
      if (othersBooting && guard.pending === version) {
        return null;
      }
      const attempts = guard.pending === version ? guard.attempts + 1 : 1;
      return { ...state, guard: { ...guard, pending: version, attempts } };
    });
    reporter.saved(saved);
  });
  const timer = setTimeout(release, BOOT_WINDOW_MS);
  const end = () => {
    clearTimeout(timer);
    release();
    if (sessions[namespace] === session) {
      delete sessions[namespace];
    }
  };
  const session: BootSession = {
    version,
    end,
    acknowledge: async () => {
      // The booting lock is released only once the acknowledgement landed: a
      // launch that no longer sees this boot must see the acknowledgement.
      try {
        await acknowledgeBoot(namespace, binary, releaseConfig, reporter);
      } finally {
        end();
      }
    },
  };
  sessions[namespace] = session;
}

/**
 * Clears `pending` if it names this package, and records the package as
 * lastGood. A `pending` naming another package belongs to another tab's boot
 * and stays. lastGood is not recorded for a blocked package (another tab
 * rolled it back meanwhile), nor when the package's cache lost files: then a
 * rollback would boot a package that is not there, so the previous lastGood
 * stays.
 */
async function acknowledgeBoot(
  namespace: string,
  binary: string,
  releaseConfig: ReleaseConfig,
  reporter: BootReporter
): Promise<void> {
  const version = releaseConfig.package.version;
  // Read before taking any lock. This page holds the package's `using` lock,
  // so no tab prunes it from here on.
  const cached = await hasPackageFiles(namespace, releaseConfig);
  let lostFiles = false;
  // Inside the guard lock, so that the acknowledgement is ordered with the
  // boot counting and rollback decisions of other launches.
  const saved = await withExclusiveLock(guardLockName(namespace), () =>
    updateState(namespace, (state) => {
      const guard = state.guard;
      // Another host deploy's guard, adopted since this boot, is not ours.
      if (
        !guard ||
        state.bundledVersion !== binary ||
        guard.binary !== binary
      ) {
        return null;
      }
      const next: GuardState = { ...guard };
      let changed = false;
      if (guard.pending === version) {
        // A healthy boot never counts against its release.
        next.pending = undefined;
        next.attempts = 0;
        changed = true;
      }
      // A substituted lastGood is already lastGood, so this only records new ones.
      const recordable =
        guard.blocked !== version &&
        guard.lastGood?.package.version !== version;
      if (recordable && cached) {
        next.lastGood = releaseConfig;
        changed = true;
      } else if (recordable) {
        lostFiles = true;
      }
      return changed ? { ...state, guard: next } : null;
    })
  );
  reporter.saved(saved);
  if (lostFiles) {
    reporter.error(
      `Airborne: package ${version} was acknowledged, but its cached files are gone; the previous last good package is kept`,
      version
    );
  }
}

// ---------------------------------------------------------------------------

/**
 * Web counterpart of the native boot flow: resolves the release config, races
 * the package against `boot_timeout`, then runs whichever bundle won. A package
 * that misses the timeout keeps downloading and is used next session.
 */
export async function bootAirborne(
  options: AirborneWebOptions
): Promise<BootResult> {
  const { namespace, bundled } = options;
  configureTelemetry(options);
  const reporter = new BootReporter(options);
  // Captured once: a later redeploy of the host page must not adopt what this
  // boot goes on downloading.
  const bundledVersion = bundled.releaseConfig.package.version;
  // What this page selects from: only state its own host deploy owns.
  const readOwnState = () =>
    ownState(
      readState(namespace),
      bundledVersion,
      options.bootGuardEnabled === true
    );
  await adoptHostDeploy(namespace, bundledVersion, reporter);
  if (options.bootGuardEnabled) {
    await openBootGuard(options, reporter).catch((error) => {
      console.warn('Airborne: boot guard unavailable', error);
    });
  } else {
    await discardBootGuard(namespace, bundledVersion, reporter);
  }
  const known = readOwnState().current;
  const timeouts = (known ?? bundled.releaseConfig).config;

  let fetched = await fetchReleaseConfig(
    options,
    sanitizeTimeout(timeouts.release_config_timeout)
  );
  if (fetched) {
    const offered = fetched;
    reporter.saved(await updateState(namespace, (state) => ({ ...state,
      blocked: [...new Set([...(state.blocked ?? []), ...(offered.blocked_package_versions ?? [])])],
    })));
  }
  // An OTA package whose index or important files cannot be verified is not
  // run. It is treated as if no release had been served: the cached package,
  // or else the bundled one, boots. The bundled package itself is exempt.
  if (fetched && fetched.package.version !== bundledVersion) {
    const unverifiable = unverifiableRequiredFiles(fetched);
    if (unverifiable.length > 0) {
      const names = unverifiable.map((file) => file.file_path).join(', ');
      reporter.error(
        `Airborne: refusing package ${fetched.package.version}: no SHA-256 checksum for ${names}; booting the cached or bundled package instead`,
        fetched.package.version
      );
      fetched = null;
    }
  }

  // A release naming the blocked package is refused outright.
  const refused =
    fetched !== null &&
    (readOwnState().blocked?.includes(fetched.package.version) ||
      (options.bootGuardEnabled === true && readOwnState().guard?.blocked === fetched.package.version));
  if (refused && fetched) {
    emit(options, {
      type: 'blocked-package',
      packageVersion: fetched!.package.version,
    });
    event(namespace, fetched!, 'blocked_package');
  }
  const latest = refused ? null : fetched;

  const live = new LiveRuntime(namespace);
  let pendingPackageVersion: string | undefined;
  let packageWork: Promise<void> = Promise.resolve();
  if (latest) {
    const version = latest.package.version;
    // Also re-download a committed package whose files were evicted.
    const needsPackage =
      version !== bundledVersion &&
      (version !== known?.package.version ||
        !(await hasPackageFiles(namespace, latest)));
    let packageSettled = true;
    if (needsPackage) {
      packageSettled = false;
      packageWork = downloadPackage(
        namespace,
        latest,
        bundledVersion,
        reporter
      ).then(() => event(namespace, latest, 'package_downloaded'));
      const settled = () => {
        packageSettled = true;
      };
      packageWork.then(settled, (error) => {
        settled();
        if (!(error instanceof StaleDownloadError)) {
          reporter.downloadFailed(version, error);
        }
      });
    }
    const work = Promise.all([
      packageWork,
      downloadResources(
        namespace,
        latest,
        bundledVersion,
        reporter,
        (cacheName, file) =>
          live.publish(
            cacheName,
            file,
            (runtime) => !isPackageFile(runtime, file.file_path)
          )
      ),
    ]);
    inBackground(work);
    await raceTimeout(work, sanitizeTimeout(latest.config.boot_timeout));
    // Only the package decides what boots: a resource still downloading does
    // not make the package pending.
    if (!packageSettled) {
      pendingPackageVersion = version;
    }
    if (!needsPackage) {
      // The same package, or the bundled one, but config properties and
      // resources may have moved on. Kept so that offline launches get them.
      const knownRelease = releaseKey(known);
      const ownRelease = releaseKey(latest);
      const saved = await updateState(namespace, (state) => {
        // Not over a newer deploy, nor over a release (package or config)
        // another tab put in state meanwhile.
        const current = releaseKey(state.current);
        if (
          state.bundledVersion !== bundledVersion ||
          (current !== knownRelease && current !== ownRelease)
        ) {
          return null;
        }
        return { ...state, current: latest };
      });
      reporter.saved(saved);
    }
  }

  let state = readOwnState();
  let selected = selectPackage(state);
  // The server rolled back to, or never moved past, what the page shipped with.
  const servesBundled = latest?.package.version === bundledVersion;
  /** The runtime of `candidate` and this page's hold on it, if it can run. */
  const openSelected = async (
    candidate: ReleaseConfig | null
  ): Promise<[AirborneWebRuntime | null, (() => void) | null]> => {
    if (
      !candidate ||
      servesBundled ||
      candidate.package.version === bundledVersion
    ) {
      return [null, null];
    }
    // Held before the cache is read, so that no other tab prunes it from
    // under this page.
    const candidateHold = await holdPackage(
      namespace,
      candidate.package.version
    );
    const bundledResources = bundledUrls(
      options,
      bundled.releaseConfig.resources
    );
    const opened = await otaRuntime(
      namespace,
      candidate,
      bundledResources
    ).catch(() => null);
    if (!opened) {
      candidateHold();
      return [null, null];
    }
    return [opened, candidateHold];
  };
  let [runtime, hold] = await openSelected(selected);
  if (!runtime && selected) {
    // Another tab may have committed a newer package and pruned this one
    // before this page held it. Select once more.
    const fresh = readOwnState();
    const reselected = selectPackage(fresh);
    if (reselected?.package.version !== selected.package.version) {
      state = fresh;
      selected = reselected;
      [runtime, hold] = await openSelected(selected);
    }
  }
  // A current naming the bundled package only carries newer config and resources.
  const selectsBundled = selected?.package.version === bundledVersion;
  const overlay = latest ?? (selectsBundled ? selected : null);
  // The package may have committed after the race; then it is not pending.
  if (
    runtime &&
    runtime.releaseConfig.package.version === pendingPackageVersion
  ) {
    pendingPackageVersion = undefined;
  }

  // Only the index and important files are read before the bundle runs. The
  // rest is published alongside it, then downloads that landed meanwhile.
  const resources = (latest ?? state.current ?? bundled.releaseConfig)
    .resources;
  const install = (next: AirborneWebRuntime, nextHold: (() => void) | null) => {
    next.pendingPackageVersion = pendingPackageVersion;
    const published = publishCachedFiles(
      namespace,
      next,
      resources,
      state.resources ?? {}
    );
    next.ready = inBackground(published.finally(() => live.attach(next)));
    installRuntime(namespace, next);
    keepPackageHold(namespace, nextHold);
  };
  let resolved = runtime ?? bundledRuntime(options, overlay);
  install(resolved, runtime ? hold : null);

  // Lazy files belong to a package that installed; the bundled one has its own.
  if (latest && latest.package.version !== bundledVersion) {
    const lazy = latest;
    inBackground(
      packageWork.then(() => downloadLazy(namespace, lazy, live, reporter))
    );
  }
  // The package running may be another one: the latest did not make it in
  // time, is blocked, or the server could not be reached. Its lazy files that
  // are still missing are fetched as well.
  if (
    runtime !== null &&
    runtime.releaseConfig.package.version !== latest?.package.version
  ) {
    inBackground(
      downloadLazy(namespace, runtime.releaseConfig, live, reporter)
    );
  }

  if (resolved.source === 'ota') event(namespace, resolved.releaseConfig, 'boot_started');
  // Bundled boots are never tracked.
  if (options.bootGuardEnabled && resolved.source === 'ota') {
    await trackBoot(options, resolved.releaseConfig, reporter);
  } else {
    endBootSession(namespace);
  }
  try {
    await injectScript(resolved.bundlePath);
  } catch (error) {
    if (resolved.source !== 'ota') {
      throw error;
    }
    // For example a Content-Security-Policy whose script-src lacks blob:.
    // The bundled package runs instead, and must not acknowledge this one.
    event(namespace, resolved.releaseConfig, 'boot_failed');
    endBootSession(namespace);
    const failedVersion = resolved.releaseConfig.package.version;
    reporter.error(
      `Airborne: could not run package ${failedVersion}, booting the bundled package instead: ${String(error)}`,
      failedVersion
    );
    resolved = bundledRuntime(options, overlay);
    install(resolved, null);
    await injectScript(resolved.bundlePath);
  }
  return {
    source: resolved.source,
    releaseConfig: resolved.releaseConfig,
    bundlePath: resolved.bundlePath,
    pendingPackageVersion,
  };
}

/**
 * Acknowledges the running OTA package once the app is usable (e.g. after its
 * first render). Works from the OTA bundle's copy of this module as well as
 * the host page's. Rejects when the namespace has not booted; a no-op unless
 * the boot guard is on and an OTA package booted.
 */
export async function markBootSuccess(namespace: string): Promise<void> {
  const runtime = requireRuntime(namespace);
  if (runtime.source === 'ota') event(namespace, runtime.releaseConfig, 'boot_success');
  await bootSessionOf(namespace)?.acknowledge();
}

/**
 * @internal Test hooks. Not exported from the package entry points and not
 * part of the public API.
 */
export const __testing = {
  /** Resolves once the background work started so far has settled. */
  async whenSettled(): Promise<void> {
    while (backgroundWork.size > 0) {
      await Promise.all([...backgroundWork]);
    }
  },
  bootWindowMs: BOOT_WINDOW_MS,
};
