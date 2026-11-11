/**
 * In-memory stand-ins for the browser APIs the web loader uses: localStorage,
 * Cache Storage, fetch, crypto.subtle, <script> injection, blob URLs and
 * navigator.locks. Shared by the web loader and boot guard tests.
 */
import { createHash, webcrypto } from 'node:crypto';

import type { ReleaseConfig, ReleaseFile } from '../../web/types';

export const ORIGIN = 'https://app.example';
export const CDN = 'https://cdn.example';
export const RELEASE_URL = 'https://airborne.example/release/acme/shop';
export const NAMESPACE = 'shop';

export function sha256(body: string): string {
  return createHash('sha256').update(body).digest('hex');
}

/** The loader's cache key of `file`: its URL, plus its checksum if any. */
export function cacheKeyOf(file: ReleaseFile): string {
  const url = new URL(file.url, ORIGIN);
  if (file.checksum) {
    url.searchParams.append('airborne-sha', file.checksum);
  }
  return url.toString();
}

/** A file served by the fake CDN with the matching checksum. */
export function cdnFile(
  filePath: string,
  body: string,
  version = ''
): ReleaseFile {
  const url = `${CDN}/${version ? `${version}/` : ''}${filePath}`;
  return { file_path: filePath, url, checksum: sha256(body) };
}

interface PackageSpec {
  version: string;
  important?: Record<string, string>;
  lazy?: Record<string, string>;
  resources?: ReleaseFile[];
  bootTimeout?: number;
}

/** Builds a release config and the CDN bodies for its package files. */
export function makeRelease(spec: PackageSpec): {
  releaseConfig: ReleaseConfig;
  bodies: Record<string, string>;
} {
  const bodies: Record<string, string> = {};
  const file = (filePath: string, body: string) => {
    const releaseFile = cdnFile(filePath, body, spec.version);
    bodies[releaseFile.url] = body;
    return releaseFile;
  };
  const indexBody = `/* index ${spec.version} */`;
  return {
    releaseConfig: {
      version: '1',
      config: {
        version: '1',
        boot_timeout: spec.bootTimeout ?? 1000,
        release_config_timeout: 1000,
      },
      package: {
        name: 'shop',
        version: spec.version,
        index: file('index.js', indexBody),
        important: Object.entries(spec.important ?? {}).map(([path, body]) =>
          file(path, body)
        ),
        lazy: Object.entries(spec.lazy ?? {}).map(([path, body]) =>
          file(path, body)
        ),
      },
      resources: spec.resources ?? [],
    },
    bodies,
  };
}

/** The release that ships with the host page. */
export function bundledRelease(version = 'bundled-1') {
  const { releaseConfig } = makeRelease({
    version,
    important: { 'chunk.js': 'bundled chunk' },
    lazy: { 'lazy.png': 'bundled lazy' },
    resources: [{ file_path: 'strings.json', url: 'unused' }],
  });
  return { releaseConfig, baseUrl: '/static/' };
}

// ---------------------------------------------------------------------------

class MemoryStorage {
  data = new Map<string, string>();
  failWrites = false;

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) {
      throw new Error('QuotaExceededError');
    }
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }
}

class MemoryCache {
  entries = new Map<
    string,
    { body: ArrayBuffer; headers: [string, string][] }
  >();

  async match(request: string | Request): Promise<Response | undefined> {
    const entry = this.entries.get(keyOf(request));
    return entry
      ? new Response(entry.body.slice(0), { headers: entry.headers })
      : undefined;
  }

  async put(request: string | Request, response: Response): Promise<void> {
    const body = await response.arrayBuffer();
    this.entries.set(keyOf(request), {
      body,
      headers: [...response.headers.entries()],
    });
  }

  async delete(request: string | Request): Promise<boolean> {
    return this.entries.delete(keyOf(request));
  }

  async keys(): Promise<Request[]> {
    return [...this.entries.keys()].map((url) => new Request(url));
  }
}

function keyOf(request: string | Request): string {
  return new URL(typeof request === 'string' ? request : request.url, ORIGIN)
    .href;
}

/**
 * Like the real thing, deleting a cache detaches open Cache objects: writes to
 * them still succeed but are no longer reachable through caches.open(name).
 */
class MemoryCacheStorage {
  caches = new Map<string, MemoryCache>();

  async open(name: string): Promise<MemoryCache> {
    let cache = this.caches.get(name);
    if (!cache) {
      cache = new MemoryCache();
      this.caches.set(name, cache);
    }
    return cache;
  }

  async has(name: string): Promise<boolean> {
    return this.caches.has(name);
  }

  async delete(name: string): Promise<boolean> {
    return this.caches.delete(name);
  }

  async keys(): Promise<string[]> {
    return [...this.caches.keys()];
  }
}

interface HeldLock {
  name: string;
  mode: LockMode;
}

/** navigator.locks with exclusive and shared modes and ifAvailable; enough for the loader. */
export class MemoryLocks {
  held: HeldLock[] = [];
  private waiters: Array<() => void> = [];

  async request<T>(
    name: string,
    optionsOrCallback: LockOptions | ((lock: unknown) => T),
    maybeCallback?: (lock: unknown) => T
  ): Promise<Awaited<T>> {
    const options =
      typeof optionsOrCallback === 'function' ? {} : optionsOrCallback;
    const callback =
      typeof optionsOrCallback === 'function'
        ? optionsOrCallback
        : maybeCallback;
    const mode = options.mode ?? 'exclusive';
    if (options.ifAvailable && !this.canGrant(name, mode)) {
      return await (callback as (lock: unknown) => T)(null);
    }
    while (!this.canGrant(name, mode)) {
      await new Promise<void>((resolve) => this.waiters.push(resolve));
    }
    const lock = { name, mode };
    this.held.push(lock);
    try {
      return await (callback as (lock: unknown) => T)(lock);
    } finally {
      // Already gone when dropAll() closed the tab that held it.
      const index = this.held.indexOf(lock);
      if (index >= 0) {
        this.held.splice(index, 1);
      }
      const waiters = this.waiters;
      this.waiters = [];
      waiters.forEach((wake) => wake());
    }
  }

  async query() {
    return { held: this.held.map((lock) => ({ ...lock })), pending: [] };
  }

  /** Every tab closed: the browser releases all their locks. */
  dropAll(): void {
    this.held = [];
  }

  private canGrant(name: string, mode: LockMode): boolean {
    const others = this.held.filter((lock) => lock.name === name);
    return mode === 'shared'
      ? others.every((lock) => lock.mode === 'shared')
      : others.length === 0;
  }
}

type Route = () => Promise<Response> | Response;

export interface FetchedRequest {
  /** Without the query string. */
  url: string;
  search: URLSearchParams;
  headers: Headers;
}

export interface WebEnvironment {
  storage: MemoryStorage;
  caches: MemoryCacheStorage;
  locks: MemoryLocks | null;
  /** URL (without query) -> handler. Unknown URLs are 404s. */
  routes: Map<string, Route>;
  /** Every URL fetched, in order (query strings stripped). */
  fetched: string[];
  /** Every network request, in order, with its query and headers. */
  requests: FetchedRequest[];
  /** Script srcs injected into the page, in order. */
  scripts: string[];
  /** Scripts this returns true for fail to run, as under a strict CSP. */
  scriptFails: (src: string) => boolean;
  /** Blob URLs created and not revoked. */
  liveBlobUrls: Map<string, Blob>;
  revokedBlobUrls: Set<string>;
  /** Serves `body` at `url`. */
  serve(url: string, body: string, status?: number): void;
  serveRelease(release: {
    releaseConfig: unknown;
    bodies?: Record<string, string>;
  }): void;
  /** A route whose response never arrives (a stalled download). */
  stall(url: string): void;
  /** Persisted loader state for NAMESPACE. */
  state(): any;
  /** Text behind a URL in the runtime file map (blob or network). */
  read(url: string): Promise<string>;
}

let blobCounter = 0;

/** Installs fresh fakes on globalThis. Call in beforeEach. */
export function installWebEnvironment(
  options: { locks?: boolean; subtle?: boolean } = {}
): WebEnvironment {
  const storage = new MemoryStorage();
  const cacheStorage = new MemoryCacheStorage();
  const locks = options.locks ? new MemoryLocks() : null;
  const routes = new Map<string, Route>();
  const fetched: string[] = [];
  const requests: FetchedRequest[] = [];
  const scripts: string[] = [];
  const liveBlobUrls = new Map<string, Blob>();
  const revokedBlobUrls = new Set<string>();

  const fetchStub = async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    const url = new URL(
      typeof input === 'string' || input instanceof URL ? input : input.url,
      ORIGIN
    );
    const blob = liveBlobUrls.get(url.href);
    if (blob) {
      return new Response(blob);
    }
    const key = `${url.origin}${url.pathname}`;
    fetched.push(key);
    requests.push({
      url: key,
      search: new URLSearchParams(url.search),
      headers: new Headers(init?.headers),
    });
    const route = routes.get(key);
    return route ? route() : new Response('missing', { status: 404 });
  };

  const scriptStub = () => {
    const script: {
      src: string;
      onload?: () => void;
      onerror?: () => void;
    } = { src: '' };
    return script;
  };

  const define = (name: string, value: unknown) => {
    Object.defineProperty(globalThis, name, {
      configurable: true,
      writable: true,
      value,
    });
  };

  define('window', globalThis);
  define('location', { href: `${ORIGIN}/app/` });
  define('localStorage', storage);
  define('caches', cacheStorage);
  define('fetch', fetchStub);
  define('navigator', locks ? { locks } : {});
  define(
    'crypto',
    options.subtle === false ? {} : { subtle: webcrypto.subtle }
  );
  define('document', {
    createElement: scriptStub,
    head: {
      appendChild(script: {
        src: string;
        onload?: () => void;
        onerror?: () => void;
      }) {
        scripts.push(script.src);
        const fails = env.scriptFails(script.src);
        setTimeout(() => (fails ? script.onerror?.() : script.onload?.()), 0);
      },
    },
  });
  URL.createObjectURL = (blob: Blob) => {
    const url = `blob:${ORIGIN}/${++blobCounter}`;
    liveBlobUrls.set(url, blob);
    return url;
  };
  URL.revokeObjectURL = (url: string) => {
    liveBlobUrls.delete(url);
    revokedBlobUrls.add(url);
  };
  delete (globalThis as { __AIRBORNE__?: unknown }).__AIRBORNE__;

  const env: WebEnvironment = {
    storage,
    caches: cacheStorage,
    locks,
    routes,
    fetched,
    requests,
    scripts,
    scriptFails: () => false,
    liveBlobUrls,
    revokedBlobUrls,
    serve(url, body, status = 200) {
      routes.set(url, () => new Response(body, { status }));
    },
    serveRelease(release) {
      routes.set(
        RELEASE_URL,
        () => new Response(JSON.stringify(release.releaseConfig))
      );
      Object.entries(release.bodies ?? {}).forEach(([url, body]) =>
        env.serve(url, body)
      );
    },
    stall(url) {
      routes.set(url, () => new Promise<Response>(() => {}));
    },
    state() {
      const raw = storage.getItem(`airborne:${NAMESPACE}:state`);
      return raw ? JSON.parse(raw) : null;
    },
    async read(url) {
      const response = await fetchStub(url);
      return response.text();
    },
  };
  return env;
}

/**
 * Watches writes of the persisted state (of NAMESPACE, with navigator.locks
 * installed). Returns the list, filled as they happen, of every write that is
 * not made under the state lock, or that is not based on a read made under
 * that same hold of the lock: a write-back of an older snapshot, which can
 * undo what another tab saved meanwhile.
 */
export function watchStateWrites(env: WebEnvironment): string[] {
  const key = `airborne:${NAMESPACE}:state`;
  const locks = env.locks!;
  const readUnder = new WeakSet<object>();
  const violations: string[] = [];
  const stateLock = () => locks.held.find((lock) => lock.name === key);
  const getItem = env.storage.getItem.bind(env.storage);
  const setItem = env.storage.setItem.bind(env.storage);
  env.storage.getItem = (name: string) => {
    const lock = name === key ? stateLock() : undefined;
    if (lock) {
      readUnder.add(lock);
    }
    return getItem(name);
  };
  env.storage.setItem = (name: string, value: string) => {
    if (name === key) {
      const lock = stateLock();
      if (!lock) {
        violations.push(`outside the state lock: ${value}`);
      } else if (!readUnder.has(lock)) {
        violations.push(`not read under this hold of the lock: ${value}`);
      }
    }
    setItem(name, value);
  };
  return violations;
}
