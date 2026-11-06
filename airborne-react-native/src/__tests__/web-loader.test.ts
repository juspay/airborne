/** @jest-environment node */
import type {
  AirborneBootEvent,
  AirborneWebOptions,
  AirborneWebRuntime,
} from '../web/types';
import {
  CDN,
  NAMESPACE,
  RELEASE_URL,
  bundledRelease,
  cacheKeyOf,
  cdnFile,
  installWebEnvironment,
  makeRelease,
  sha256,
  watchStateWrites,
  type WebEnvironment,
} from './support/webEnvironment';

type Loader = typeof import('../web/loader');
type WebApi = typeof import('../index.web');

const bundled = bundledRelease();

let env: WebEnvironment;
let loader: Loader;
let api: WebApi;

function load() {
  jest.resetModules();
  loader = require('../web/loader');
  api = require('../index.web');
}

beforeEach(() => {
  env = installWebEnvironment();
  load();
});

function boot(options: Partial<AirborneWebOptions> = {}) {
  return loader.bootAirborne({
    releaseConfigUrl: RELEASE_URL,
    namespace: NAMESPACE,
    bundled,
    ...options,
  });
}

/** Waits for the downloads and publishes the last boot left running. */
function settle() {
  return loader.__testing.whenSettled();
}

/** A fresh page load against the same storage and caches. */
async function relaunch() {
  load();
  const result = await boot();
  await settle();
  return result;
}

/** Serves `body` at `url` once `respond()` is called. */
function serveLater(url: string, body: string): () => void {
  let respond = () => {};
  env.routes.set(
    url,
    () =>
      new Promise<Response>((resolve) => {
        respond = () => resolve(new Response(body));
      })
  );
  return () => respond();
}

/**
 * Serves `url` with `later` the first time, once `respond()` is called, and
 * with `body` (status `status`) every time after.
 */
function serveFirstLater(
  url: string,
  later: string,
  body: string,
  status = 200
): () => void {
  let respond = () => {};
  let first = true;
  env.routes.set(url, () => {
    if (!first) {
      return new Response(body, { status });
    }
    first = false;
    return new Promise<Response>((resolve) => {
      respond = () => resolve(new Response(later));
    });
  });
  return () => respond();
}

/** Lets background work run until `done()` holds, without waiting on stalls. */
async function until(done: () => boolean) {
  for (let turn = 0; turn < 200 && !done(); turn++) {
    await new Promise((resolve) => setImmediate(resolve));
  }
  expect(done()).toBe(true);
}

/** Serves `body` at `url` after a few milliseconds, like a real network. */
function serveSlowly(url: string, body: string) {
  env.routes.set(
    url,
    () =>
      new Promise<Response>((resolve) =>
        setTimeout(() => resolve(new Response(body)), 5)
      )
  );
}

function runtime(): AirborneWebRuntime {
  const current = window.__AIRBORNE__?.[NAMESPACE];
  if (!current) {
    throw new Error('not booted');
  }
  return current;
}

const packageCache = (version: string) =>
  env.caches.caches.get(`airborne:${NAMESPACE}:package:${version}`);
const resourceCache = () =>
  env.caches.caches.get(`airborne:${NAMESPACE}:resources`);

const v1 = makeRelease({
  version: 'v1',
  important: { 'chunk.js': 'chunk v1' },
  lazy: { 'lazy.png': 'lazy v1' },
});

describe('release config request', () => {
  it('sends sorted dimensions and a sticky toss', async () => {
    env.serveRelease(v1);
    await boot({ dimensions: { b: '2', a: '1' } });
    await settle();
    await relaunch();

    const requests = env.requests.filter(
      (request) => request.url === RELEASE_URL
    );
    expect(requests).toHaveLength(2);
    expect(requests[0]!.headers.get('x-dimension')).toBe('a=1;b=2;');
    expect(requests[1]!.headers.get('x-dimension')).toBeNull();
    const toss = requests[0]!.search.get('toss');
    expect(toss).toMatch(/^\d{1,2}$/);
    expect(requests[1]!.search.get('toss')).toBe(toss);
  });
});

describe('file API', () => {
  it('treats namespaces as plain keys, not object properties', async () => {
    env.serveRelease(v1);
    const result = await boot({ namespace: 'constructor' });
    await settle();
    expect(result.source).toBe('ota');
    await expect(api.getBundlePath('constructor')).resolves.toBe(
      result.bundlePath
    );
    await expect(api.getFileContent('constructor', 'lazy.png')).resolves.toBe(
      'lazy v1'
    );
    await expect(api.getFileUrl('constructor', 'toString')).resolves.toBeNull();
    await expect(api.getBundlePath('toString')).rejects.toThrow(
      /has not booted/
    );
  });

  it('reads files and rejects HTTP errors and unknown paths', async () => {
    await expect(api.getFileContent(NAMESPACE, 'config.json')).rejects.toThrow(
      /has not booted/
    );
    window.__AIRBORNE__ = {
      [NAMESPACE]: {
        source: 'bundled',
        releaseConfig: bundled.releaseConfig,
        bundlePath: `${CDN}/index.js`,
        files: { 'config.json': `${CDN}/config.json` },
      },
    };

    env.serve(`${CDN}/config.json`, 'gone', 404);
    await expect(api.getFileContent(NAMESPACE, 'config.json')).rejects.toThrow(
      /404/
    );

    env.serve(`${CDN}/config.json`, '{"ready":true}');
    await expect(api.getFileContent(NAMESPACE, 'config.json')).resolves.toBe(
      '{"ready":true}'
    );
    await expect(api.getFileContent(NAMESPACE, 'missing')).rejects.toThrow(
      /not available/
    );
    await expect(api.getFileUrl(NAMESPACE, 'missing')).resolves.toBeNull();
  });
});

describe('packages', () => {
  it('runs a downloaded package, then the cached copy offline', async () => {
    env.serveRelease(v1);
    const first = await boot();
    await settle();

    expect(first.source).toBe('ota');
    expect(await env.read(first.bundlePath)).toBe('/* index v1 */');
    expect(env.scripts).toEqual([first.bundlePath]);
    expect(await api.getFileContent(NAMESPACE, 'chunk.js')).toBe('chunk v1');
    // Lazy files land after boot and are published into the live runtime.
    expect(await api.getFileContent(NAMESPACE, 'lazy.png')).toBe('lazy v1');

    env.routes.clear();
    const offline = await relaunch();
    expect(offline.source).toBe('ota');
    expect(offline.releaseConfig.package.version).toBe('v1');
    expect(await api.getFileContent(NAMESPACE, 'chunk.js')).toBe('chunk v1');
  });

  it('boots the bundled package when the server serves it', async () => {
    env.serveRelease(v1);
    await boot();
    env.serveRelease({ releaseConfig: bundled.releaseConfig });

    const result = await relaunch();
    expect(result.source).toBe('bundled');
    expect(result.bundlePath).toBe('https://app.example/static/index.js');
    expect(runtime().files['chunk.js']).toBe(
      'https://app.example/static/chunk.js'
    );
  });

  it('does not commit a package that fails its checksum', async () => {
    env.serveRelease(v1);
    env.serve(v1.releaseConfig.package.important[0]!.url, 'tampered');

    const result = await boot();
    expect(result.source).toBe('bundled');
    expect(env.state()?.current ?? null).toBeNull();
  });

  it('verifies cached package files before running them', async () => {
    env.serveRelease(v1);
    await boot();
    const chunkUrl = cacheKeyOf(v1.releaseConfig.package.important[0]!);
    await packageCache('v1')!.put(chunkUrl, new Response('tampered'));

    env.routes.clear();
    const offline = await relaunch();
    expect(offline.source).toBe('bundled');
    // The corrupt entry is gone, so the next online boot downloads it again.
    expect(await packageCache('v1')!.match(chunkUrl)).toBeUndefined();

    env.serveRelease(v1);
    const repaired = await relaunch();
    expect(repaired.source).toBe('ota');
    expect(await api.getFileContent(NAMESPACE, 'chunk.js')).toBe('chunk v1');
  });

  it('re-downloads a committed package whose cache was evicted', async () => {
    env.serveRelease(v1);
    await boot();
    env.caches.caches.clear();

    const result = await relaunch();
    expect(result.source).toBe('ota');
    expect(await env.read(result.bundlePath)).toBe('/* index v1 */');
  });

  it('treats checksummed files as unverified without crypto.subtle', async () => {
    env = installWebEnvironment({ subtle: false });
    env.serveRelease(v1);

    const result = await boot();
    expect(result.source).toBe('bundled');
    expect(env.state()?.current ?? null).toBeNull();
  });

  it('does not commit a package whose cache another tab pruned', async () => {
    const slow = makeRelease({
      version: 'v1',
      important: { 'chunk.js': 'chunk v1' },
      bootTimeout: 10,
    });
    env.serveRelease(slow);
    const chunk = slow.releaseConfig.package.important[0]!;
    const respond = serveLater(chunk.url, 'chunk v1');

    const result = await boot();
    expect(result.source).toBe('bundled');
    expect(result.pendingPackageVersion).toBe('v1');

    await env.caches.delete(`airborne:${NAMESPACE}:package:v1`);
    respond();
    await settle();
    expect(env.state()?.current ?? null).toBeNull();
  });

  it('deletes the cache of a package that failed to download', async () => {
    const v2 = makeRelease({
      version: 'v2',
      important: { 'chunk.js': 'chunk v2', 'extra.js': 'extra v2' },
    });
    env.serveRelease(v2);
    env.serve(v2.releaseConfig.package.important[1]!.url, 'gone', 500);

    const result = await boot();
    await settle();
    expect(result.source).toBe('bundled');
    expect(packageCache('v2')).toBeUndefined();
  });

  it('keeps only the cache of the committed package', async () => {
    env.serveRelease(v1);
    await boot();
    await settle();

    const v2 = makeRelease({
      version: 'v2',
      important: { 'chunk.js': 'chunk v2' },
    });
    env.serveRelease(v2);
    const result = await relaunch();
    expect(result.releaseConfig.package.version).toBe('v2');
    expect(packageCache('v1')).toBeUndefined();
    expect(packageCache('v2')).toBeDefined();
    expect(env.state()).not.toHaveProperty('previousPackageVersion');
  });

  it('drops packages cached under an older host deploy', async () => {
    env.serveRelease(v1);
    await boot();
    await settle();
    expect(env.state().bundledVersion).toBe('bundled-1');

    // Offline, the newer page must not run the older cached package.
    env.routes.clear();
    load();
    const result = await boot({ bundled: bundledRelease('bundled-2') });
    expect(result.source).toBe('bundled');
    expect(result.releaseConfig.package.version).toBe('bundled-2');
    expect(packageCache('v1')).toBeUndefined();
    expect(env.state()).toMatchObject({
      bundledVersion: 'bundled-2',
      current: null,
    });
  });

  it('does not commit a package an older host deploy was downloading', async () => {
    env.serveRelease(v1);
    let respondRelease = () => {};
    env.routes.set(
      RELEASE_URL,
      () =>
        new Promise<Response>((resolve) => {
          respondRelease = () =>
            resolve(new Response(JSON.stringify(v1.releaseConfig)));
        })
    );
    const oldTab = loader;
    const oldBoot = boot();
    while (!env.fetched.includes(RELEASE_URL)) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    // The host page is redeployed and a new tab adopts it, offline.
    env.routes.delete(RELEASE_URL);
    load();
    const fresh = await boot({ bundled: bundledRelease('bundled-2') });
    expect(fresh.source).toBe('bundled');

    // The old tab only now hears of v1 and downloads it.
    respondRelease();
    expect((await oldBoot).source).toBe('bundled');
    await oldTab.__testing.whenSettled();
    expect(env.state()).toMatchObject({
      bundledVersion: 'bundled-2',
      current: null,
    });
    expect(packageCache('v1')).toBeUndefined();
  });

  it('does not record resources of a release older than the one in state', async () => {
    const oldStrings = cdnFile('strings.json', 'old', 'r1');
    const newStrings = cdnFile('strings.json', 'new', 'r2');
    // The first tab's copy of the old strings is slow.
    env.serveRelease({
      releaseConfig: {
        ...v1.releaseConfig,
        config: { ...v1.releaseConfig.config, boot_timeout: 10 },
        resources: [oldStrings],
      },
      bodies: v1.bodies,
    });
    const respond = serveLater(oldStrings.url, 'old');
    const firstTab = loader;
    await boot();
    await until(() => env.state()?.current?.package.version === 'v1');

    // A second tab gets the next release of v1 and records its strings.
    env.serveRelease({
      releaseConfig: {
        ...v1.releaseConfig,
        config: { ...v1.releaseConfig.config, version: '2' },
        resources: [newStrings],
      },
      bodies: { ...v1.bodies, [newStrings.url]: 'new' },
    });
    await relaunch();
    expect(env.state().resources['strings.json'].url).toBe(newStrings.url);

    // The first tab's old strings land last; the newer ones stay.
    respond();
    await firstTab.__testing.whenSettled();
    expect(env.state().resources['strings.json'].url).toBe(newStrings.url);
    env.routes.clear();
    await relaunch();
    expect(await api.getFileContent(NAMESPACE, 'strings.json')).toBe('new');
  });

  it('does not replace a newer config of the same package', async () => {
    env.serveRelease(v1);
    await boot();
    await settle();
    const configured = (version: string) => ({
      ...v1.releaseConfig,
      config: { ...v1.releaseConfig.config, version },
    });
    // The next tab's release request is slow and brings c1; later ones c2.
    let respond = () => {};
    let first = true;
    env.routes.set(RELEASE_URL, () => {
      if (!first) {
        return new Response(JSON.stringify(configured('c2')));
      }
      first = false;
      return new Promise<Response>((resolve) => {
        respond = () => resolve(new Response(JSON.stringify(configured('c1'))));
      });
    });
    const releaseRequests = () =>
      env.fetched.filter((url) => url === RELEASE_URL).length;
    load();
    const lateTab = loader;
    const late = boot();
    await until(() => releaseRequests() === 2);

    await relaunch();
    expect(env.state().current.config.version).toBe('c2');
    respond();
    await late;
    await lateTab.__testing.whenSettled();
    expect(env.state().current.config.version).toBe('c2');
  });

  it('keeps the newer bytes of a resource republished at the same URL', async () => {
    const url = `${CDN}/strings.json`;
    const older = { file_path: 'strings.json', url, checksum: sha256('old') };
    const newer = { ...older, checksum: sha256('new') };
    const config = v1.releaseConfig.config;
    // The first tab's download of the older bytes finishes last.
    env.serveRelease({
      releaseConfig: {
        ...v1.releaseConfig,
        config: { ...config, boot_timeout: 10 },
        resources: [older],
      },
      bodies: v1.bodies,
    });
    const respond = serveFirstLater(url, 'old', 'new');
    const firstTab = loader;
    await boot();
    await until(() => env.state()?.current?.package.version === 'v1');

    env.serveRelease({
      releaseConfig: {
        ...v1.releaseConfig,
        config: { ...config, version: '2' },
        resources: [newer],
      },
      bodies: v1.bodies,
    });
    await relaunch();
    respond();
    await firstTab.__testing.whenSettled();

    env.routes.clear();
    await relaunch();
    expect(await api.getFileContent(NAMESPACE, 'strings.json')).toBe('new');
  });

  it('never lets a resource replace a file of the running package', async () => {
    env.serveRelease(v1);
    await boot();
    await settle();
    // The next release lists chunk.js as a resource; its package fails, so
    // v1 keeps running.
    const chunkResource = cdnFile('chunk.js', 'resource chunk', 'r1');
    const v2 = makeRelease({ version: 'v2' });
    env.serveRelease({
      releaseConfig: { ...v2.releaseConfig, resources: [chunkResource] },
      bodies: { [chunkResource.url]: 'resource chunk' },
    });
    env.serve(v2.releaseConfig.package.index.url, 'down', 500);

    // Published as it lands, then from the cache on the next launch.
    for (let launch = 0; launch < 2; launch++) {
      const result = await relaunch();
      expect(result.releaseConfig.package.version).toBe('v1');
      expect(await api.getFileContent(NAMESPACE, 'chunk.js')).toBe('chunk v1');
    }
    expect(resourceCache()!.entries.has(cacheKeyOf(chunkResource))).toBe(true);
  });

  it('keeps caches of a namespace another namespace is a prefix of', async () => {
    env.serveRelease(v1);
    await boot({ namespace: 'a:package:b' });
    await settle();

    // Namespace "a" installs v2 and prunes its own caches.
    const v2 = makeRelease({ version: 'v2' });
    env.serveRelease(v2);
    load();
    expect((await boot({ namespace: 'a' })).releaseConfig.package.version).toBe(
      'v2'
    );
    await settle();

    env.routes.clear();
    load();
    const offline = await boot({ namespace: 'a:package:b' });
    expect(offline.source).toBe('ota');
    expect(offline.releaseConfig.package.version).toBe('v1');
  });

  it('retries the missing lazy files of the package that runs', async () => {
    const lazy = v1.releaseConfig.package.lazy[0]!;
    env.serveRelease(v1);
    env.serve(lazy.url, 'gone', 404);
    await boot();
    await settle();
    expect(packageCache('v1')!.entries.has(cacheKeyOf(lazy))).toBe(false);

    // v2 misses the boot timeout, so v1 runs; its lazy file is back.
    const v2 = makeRelease({ version: 'v2', bootTimeout: 10 });
    env.serveRelease(v2);
    env.stall(v2.releaseConfig.package.index.url);
    env.serve(lazy.url, 'lazy v1');
    load();
    const result = await boot();
    expect(result.releaseConfig.package.version).toBe('v1');
    await until(
      () => runtime().files['lazy.png']?.startsWith('blob:') ?? false
    );
    expect(await api.getFileContent(NAMESPACE, 'lazy.png')).toBe('lazy v1');
  });

  it('reports a package that fails to download in the background', async () => {
    const events: AirborneBootEvent[] = [];
    const v2 = makeRelease({
      version: 'v2',
      important: { 'chunk.js': 'chunk v2', 'extra.js': 'extra v2' },
    });
    env.serveRelease(v2);
    v2.releaseConfig.package.important.forEach((file) =>
      env.serve(file.url, 'gone', 500)
    );

    const result = await boot({ onEvent: (event) => events.push(event) });
    await settle();
    expect(result.source).toBe('bundled');
    // Two files failed; the package is reported once.
    expect(events).toEqual([
      {
        type: 'error',
        message: expect.stringMatching(/package v2 failed.*500/),
        packageVersion: 'v2',
      },
    ]);
  });

  it('reports lazy files that fail to download, once per package', async () => {
    const events: AirborneBootEvent[] = [];
    const v2 = makeRelease({
      version: 'v2',
      lazy: { 'a.png': 'a', 'b.png': 'b' },
    });
    env.serveRelease(v2);
    v2.releaseConfig.package.lazy.forEach((file) =>
      env.serve(file.url, 'gone', 404)
    );

    const result = await boot({ onEvent: (event) => events.push(event) });
    await settle();
    expect(result.source).toBe('ota');
    expect(events).toEqual([
      {
        type: 'error',
        message: expect.stringMatching(/package v2 failed.*404/),
        packageVersion: 'v2',
      },
    ]);
  });

  it('boots the bundled package while a new host deploy cannot be adopted', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    env.serveRelease(v1);
    await boot();
    await settle();

    // Storage is full: the redeployed page cannot record that it took over.
    env.storage.failWrites = true;
    for (let launch = 0; launch < 2; launch++) {
      const events: AirborneBootEvent[] = [];
      load();
      const result = await boot({
        bundled: bundledRelease('bundled-2'),
        onEvent: (event) => events.push(event),
      });
      await settle();
      expect(result.source).toBe('bundled');
      expect(result.releaseConfig.package.version).toBe('bundled-2');
      expect(events).toEqual([
        { type: 'error', message: expect.stringMatching(/could not save/) },
      ]);
    }
    expect(env.state().bundledVersion).toBe('bundled-1');
    warn.mockRestore();
  });

  it('does not boot a package a newer host deploy committed while this page booted', async () => {
    env.serveRelease(v1);
    let respondRelease = () => {};
    let first = true;
    env.routes.set(RELEASE_URL, () => {
      const response = () => new Response(JSON.stringify(v1.releaseConfig));
      if (!first) {
        return response();
      }
      first = false;
      return new Promise<Response>((resolve) => {
        respondRelease = () => resolve(response());
      });
    });
    const oldTab = loader;
    const oldBoot = boot();
    while (!env.fetched.includes(RELEASE_URL)) {
      await new Promise((resolve) => setImmediate(resolve));
    }

    // The host page is redeployed; a new tab adopts it and installs v1.
    load();
    const fresh = await boot({ bundled: bundledRelease('bundled-2') });
    await settle();
    expect(fresh.releaseConfig.package.version).toBe('v1');

    // The old tab only now hears of v1. It belongs to the newer deploy.
    respondRelease();
    const old = await oldBoot;
    await oldTab.__testing.whenSettled();
    expect(old.source).toBe('bundled');
    expect(old.releaseConfig.package.version).toBe('bundled-1');
    expect(env.state()).toMatchObject({
      bundledVersion: 'bundled-2',
      current: { package: { version: 'v1' } },
    });
    expect(packageCache('v1')).toBeDefined();
  });

  it('does not report a package that booted as pending', async () => {
    const strings = cdnFile('strings.json', '{"hi":1}', 'r1');
    const bootTimeout = 60_000;
    env.serveRelease({
      releaseConfig: {
        ...v1.releaseConfig,
        config: { ...v1.releaseConfig.config, boot_timeout: bootTimeout },
        resources: [strings],
      },
      bodies: v1.bodies,
    });
    // The package lands in time; a resource is still downloading.
    const respond = serveLater(strings.url, '{"hi":1}');
    const timers = jest.spyOn(globalThis, 'setTimeout');

    const booting = boot();
    await until(() => env.state()?.current?.package.version === 'v1');
    await new Promise((resolve) => setImmediate(resolve));
    // The boot timeout runs out only now, after the package committed.
    const timeout = timers.mock.calls.find((call) => call[1] === bootTimeout);
    timers.mockRestore();
    expect(timeout).toBeDefined();
    (timeout![0] as () => void)();
    const result = await booting;
    expect(result.source).toBe('ota');
    expect(result.releaseConfig.package.version).toBe('v1');
    expect(result.pendingPackageVersion).toBeUndefined();
    expect(runtime().pendingPackageVersion).toBeUndefined();
    respond();
    await settle();
  });

  it('boots the bundled package when the OTA bundle cannot run', async () => {
    const events: AirborneBootEvent[] = [];
    env.serveRelease(v1);
    // A Content-Security-Policy whose script-src does not allow blob: URLs.
    env.scriptFails = (src) => src.startsWith('blob:');

    const result = await boot({ onEvent: (event) => events.push(event) });
    expect(result.source).toBe('bundled');
    expect(result.bundlePath).toBe('https://app.example/static/index.js');
    expect(env.scripts).toEqual([
      expect.stringMatching(/^blob:/),
      result.bundlePath,
    ]);
    expect(events).toEqual([
      {
        type: 'error',
        message: expect.stringContaining('v1'),
        packageVersion: 'v1',
      },
    ]);
    expect(runtime().source).toBe('bundled');
    expect(env.revokedBlobUrls.has(env.scripts[0]!)).toBe(true);

    await settle();
    // Files of the package that could not run stay out of the bundled runtime.
    expect(runtime().files['chunk.js']).toBe(
      'https://app.example/static/chunk.js'
    );
    expect(runtime().files['lazy.png']).toBe(
      'https://app.example/static/lazy.png'
    );
    expect(
      [...env.liveBlobUrls.keys()].filter((url) =>
        Object.values(runtime().files).includes(url)
      )
    ).toEqual([]);
  });

  it('does not serve bundled copies of package files over an OTA package', async () => {
    env.serveRelease(v1);
    env.stall(v1.releaseConfig.package.lazy[0]!.url);

    const result = await boot();
    expect(result.source).toBe('ota');
    // The bundled lazy.png belongs to another version.
    await expect(api.getFileUrl(NAMESPACE, 'lazy.png')).resolves.toBeNull();
    // Resources still fall back to the copies deployed with the page.
    await expect(api.getFileUrl(NAMESPACE, 'strings.json')).resolves.toBe(
      'https://app.example/static/strings.json'
    );
  });

  it('reads only the index and important files before running the bundle', async () => {
    const strings = cdnFile('strings.json', '{"hi":1}', 'r1');
    env.serveRelease({
      releaseConfig: { ...v1.releaseConfig, resources: [strings] },
      bodies: { ...v1.bodies, [strings.url]: '{"hi":1}' },
    });
    await boot();
    await settle();

    let hashes = 0;
    let hashesBeforeScript = -1;
    const subtle = globalThis.crypto.subtle;
    Object.defineProperty(globalThis, 'crypto', {
      configurable: true,
      writable: true,
      value: {
        subtle: {
          digest(algorithm: AlgorithmIdentifier, data: BufferSource) {
            hashes += 1;
            return subtle.digest(algorithm, data);
          },
        },
      },
    });
    const head = document.head as unknown as {
      appendChild: (script: unknown) => void;
    };
    const append = head.appendChild;
    head.appendChild = (script) => {
      hashesBeforeScript = hashes;
      append(script);
    };

    load();
    const result = await boot();
    expect(result.source).toBe('ota');
    expect(hashesBeforeScript).toBe(2);
    // Readers wait for the files cached before boot.
    expect(await api.getFileContent(NAMESPACE, 'lazy.png')).toBe('lazy v1');
    expect(await api.getFileContent(NAMESPACE, 'strings.json')).toBe(
      '{"hi":1}'
    );
    await settle();
    // Downloads trust the checksum recorded with each cached file.
    expect(hashes).toBe(4);
  });
});

describe('timeouts', () => {
  it.each([0, -1, 2 ** 31])(
    'treats a timeout of %p ms as the default',
    async (timeout) => {
      const config = {
        ...v1.releaseConfig.config,
        boot_timeout: timeout,
        release_config_timeout: timeout,
      };
      env.serveRelease({
        releaseConfig: { ...v1.releaseConfig, config },
        bodies: v1.bodies,
      });
      serveSlowly(v1.releaseConfig.package.index.url, '/* index v1 */');
      const first = await boot();
      await settle();
      expect(first.source).toBe('ota');

      // The next fetch uses the persisted release_config_timeout.
      const v2 = makeRelease({
        version: 'v2',
        important: { 'chunk.js': 'chunk v2' },
      });
      env.serveRelease(v2);
      serveSlowly(RELEASE_URL, JSON.stringify(v2.releaseConfig));
      const next = await relaunch();
      expect(next.releaseConfig.package.version).toBe('v2');
    }
  );
});

describe('malformed data', () => {
  it.each([
    ['an empty object', {}],
    ['a config without a package', { ...v1.releaseConfig, package: {} }],
    ['string timeouts', { ...v1.releaseConfig, config: { boot_timeout: '1' } }],
    ['no resources array', { ...v1.releaseConfig, resources: null }],
  ])('ignores a release config with %s', async (_name, releaseConfig) => {
    env.serveRelease({ releaseConfig });
    const result = await boot();
    expect(result.source).toBe('bundled');
    expect(env.scripts).toEqual(['https://app.example/static/index.js']);
  });

  it('ignores malformed persisted state', async () => {
    env.storage.setItem(
      `airborne:${NAMESPACE}:state`,
      JSON.stringify({ current: {}, resources: { 'a.json': { url: 1 } } })
    );
    const result = await boot();
    expect(result.source).toBe('bundled');
    expect(env.scripts).toHaveLength(1);
  });

  it('still boots when storage writes fail', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    env.serveRelease(v1);
    await boot();

    env.storage.failWrites = true;
    const cached = await relaunch();
    expect(cached.source).toBe('ota');
    expect(env.scripts).toEqual([expect.any(String), cached.bundlePath]);

    // A new package cannot be committed, so the cached one keeps running.
    const v2 = makeRelease({
      version: 'v2',
      important: { 'chunk.js': 'chunk v2' },
    });
    env.serveRelease(v2);
    const result = await relaunch();
    expect(result.releaseConfig.package.version).toBe('v1');
    expect(env.scripts).toHaveLength(3);
    warn.mockRestore();
  });

  it('reports state it cannot save, once per boot', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const events: AirborneBootEvent[] = [];
    env.storage.failWrites = true;
    env.serveRelease(v1);

    const result = await boot({ onEvent: (event) => events.push(event) });
    await settle();
    expect(result.source).toBe('bundled');
    expect(events).toEqual([
      { type: 'error', message: expect.stringMatching(/could not save/) },
    ]);

    // A listener that throws does not break the boot.
    load();
    const next = await boot({
      onEvent: () => {
        throw new Error('listener');
      },
    });
    expect(next.source).toBe('bundled');
    expect(env.scripts).toHaveLength(2);
    warn.mockRestore();
  });
});

describe('resources', () => {
  const strings = (body: string, version: string) =>
    cdnFile('strings.json', body, version);

  function releaseWith(
    resources: ReturnType<typeof cdnFile>[],
    bodies: Record<string, string>
  ) {
    return {
      releaseConfig: { ...v1.releaseConfig, resources },
      bodies: { ...v1.bodies, ...bodies },
    };
  }

  it('keeps serving the previous copy when an update fails', async () => {
    const old = strings('{"hi":"old"}', 'r1');
    env.serveRelease(releaseWith([old], { [old.url]: '{"hi":"old"}' }));
    await boot();

    const next = strings('{"hi":"new"}', 'r2');
    env.serveRelease(releaseWith([next], {}));
    env.serve(next.url, 'unavailable', 500);
    await relaunch();
    expect(await api.getFileContent(NAMESPACE, 'strings.json')).toBe(
      '{"hi":"old"}'
    );
  });

  it('refetches a cached URL whose checksum changed', async () => {
    const url = `${CDN}/strings.json`;
    const first = {
      file_path: 'strings.json',
      url,
      checksum: strings('one', '').checksum,
    };
    env.serveRelease(releaseWith([first], { [url]: 'one' }));
    await boot();
    expect(await api.getFileContent(NAMESPACE, 'strings.json')).toBe('one');

    const second = { ...first, checksum: strings('two', '').checksum };
    env.serveRelease(releaseWith([second], { [url]: 'two' }));
    await relaunch();
    expect(await api.getFileContent(NAMESPACE, 'strings.json')).toBe('two');
  });

  it('applies resource updates while running the bundled package', async () => {
    const update = strings('{"hi":"ota"}', 'r1');
    env.serveRelease({
      releaseConfig: { ...bundled.releaseConfig, resources: [update] },
      bodies: { [update.url]: '{"hi":"ota"}' },
    });

    const result = await boot();
    expect(result.source).toBe('bundled');
    expect(await api.getFileContent(NAMESPACE, 'strings.json')).toBe(
      '{"hi":"ota"}'
    );
  });

  it('keeps config and resources of the bundled package for offline launches', async () => {
    const banner = cdnFile('banner.json', 'banner', 'r1');
    const served = {
      ...bundled.releaseConfig,
      config: {
        ...bundled.releaseConfig.config,
        properties: { theme: 'dark' },
      },
      resources: [banner],
    };
    env.serveRelease({
      releaseConfig: served,
      bodies: { [banner.url]: 'banner' },
    });
    await boot();
    await settle();
    expect(await api.getFileContent(NAMESPACE, 'banner.json')).toBe('banner');

    env.routes.clear();
    const offline = await relaunch();
    expect(offline.source).toBe('bundled');
    expect(offline.bundlePath).toBe('https://app.example/static/index.js');
    expect(offline.releaseConfig.config).toEqual(served.config);
    expect(runtime().files['chunk.js']).toBe(
      'https://app.example/static/chunk.js'
    );
    expect(await api.getFileContent(NAMESPACE, 'banner.json')).toBe('banner');
  });

  it('publishes resources that finish after boot', async () => {
    const late = strings('{"hi":"late"}', 'r1');
    env.serveRelease({
      releaseConfig: {
        ...bundled.releaseConfig,
        config: { ...bundled.releaseConfig.config, boot_timeout: 10 },
        resources: [late],
      },
    });
    const respond = serveLater(late.url, '{"hi":"late"}');

    await boot();
    await expect(api.getFileUrl(NAMESPACE, 'strings.json')).resolves.toBe(
      'https://app.example/static/strings.json'
    );
    respond();
    await settle();
    expect(await api.getFileContent(NAMESPACE, 'strings.json')).toBe(
      '{"hi":"late"}'
    );
  });

  it('replaces a resource republished at the same URL once it lands', async () => {
    const url = `${CDN}/strings.json`;
    const first = { file_path: 'strings.json', url, checksum: sha256('one') };
    env.serveRelease(releaseWith([first], { [url]: 'one' }));
    await boot();
    await settle();

    const second = { ...first, checksum: sha256('two') };
    env.serveRelease({
      releaseConfig: {
        ...v1.releaseConfig,
        config: { ...v1.releaseConfig.config, boot_timeout: 10 },
        resources: [second],
      },
    });
    const respond = serveLater(url, 'two');
    load();
    await boot();
    expect(await api.getFileContent(NAMESPACE, 'strings.json')).toBe('one');

    respond();
    await settle();
    expect(await api.getFileContent(NAMESPACE, 'strings.json')).toBe('two');
  });

  it('prunes cached resources no release refers to', async () => {
    const a = cdnFile('a.json', 'a', 'r1');
    env.serveRelease(releaseWith([a], { [a.url]: 'a' }));
    await boot();
    await settle();

    const b = cdnFile('b.json', 'b', 'r2');
    env.serveRelease(releaseWith([b], { [b.url]: 'b' }));
    await relaunch();
    expect([...resourceCache()!.entries.keys()]).toEqual([cacheKeyOf(b)]);
    expect(Object.keys(env.state().resources)).toEqual(['b.json']);
  });
});

describe('across tabs', () => {
  const stateKey = `airborne:${NAMESPACE}:state`;
  const strings = cdnFile('strings.json', '{"hi":1}', 'r1');

  beforeEach(() => {
    env = installWebEnvironment({ locks: true });
  });

  it('keeps a commit another tab saves while resources are recorded', async () => {
    env.serveRelease(v1);
    await boot();
    await settle();
    const v2 = makeRelease({ version: 'v2' });

    // The next launch records a resource. While it reads the state to do so,
    // another tab commits v2, under the state lock as the loader does.
    env.serveRelease({
      releaseConfig: { ...v1.releaseConfig, resources: [strings] },
      bodies: { ...v1.bodies, [strings.url]: '{"hi":1}' },
    });
    let otherTab: Promise<unknown> | undefined;
    const getItem = env.storage.getItem.bind(env.storage);
    // Right after the read, as another process could.
    env.storage.getItem = (name: string) => {
      const value = getItem(name);
      if (!otherTab && name === stateKey && env.fetched.includes(strings.url)) {
        otherTab = env.locks!.request(stateKey, () => {
          const state = JSON.parse(getItem(stateKey)!);
          state.current = v2.releaseConfig;
          env.storage.setItem(stateKey, JSON.stringify(state));
        });
      }
      return value;
    };
    await relaunch();
    await otherTab;

    expect(otherTab).toBeDefined();
    expect(env.state().current.package.version).toBe('v2');
    expect(Object.keys(env.state().resources)).toEqual(['strings.json']);
  });

  it('does not commit for an older deploy adopted while the commit is checked', async () => {
    const slow = makeRelease({
      version: 'v1',
      important: { 'chunk.js': 'chunk v1' },
      bootTimeout: 10,
    });
    env.serveRelease(slow);
    const chunk = slow.releaseConfig.package.important[0]!;
    const respond = serveLater(chunk.url, 'chunk v1');
    const oldTab = loader;
    expect((await boot()).pendingPackageVersion).toBe('v1');

    // A tab of the redeployed page adopts it, offline, while the old tab
    // checks the files it is about to commit.
    let fresh: Promise<unknown> | undefined;
    const has = env.caches.has.bind(env.caches);
    env.caches.has = async (name: string) => {
      if (!fresh && name === `airborne:${NAMESPACE}:package:v1`) {
        env.routes.delete(RELEASE_URL);
        load();
        fresh = boot({ bundled: bundledRelease('bundled-2') });
      }
      return has(name);
    };
    respond();
    await oldTab.__testing.whenSettled();
    await fresh;
    await settle();

    expect(fresh).toBeDefined();
    expect(env.state()).toMatchObject({
      bundledVersion: 'bundled-2',
      current: null,
    });
    expect(packageCache('v1')).toBeUndefined();
  });

  it('keeps the cache of a package another tab is running', async () => {
    env.serveRelease(v1);
    expect((await boot()).releaseConfig.package.version).toBe('v1');
    await settle();
    const lazyUrl = cacheKeyOf(v1.releaseConfig.package.lazy[0]!);
    expect(packageCache('v1')!.entries.has(lazyUrl)).toBe(true);

    // A second tab installs v2; the first one still runs v1.
    const v2 = makeRelease({ version: 'v2' });
    env.serveRelease(v2);
    expect((await relaunch()).releaseConfig.package.version).toBe('v2');
    expect(packageCache('v1')!.entries.has(lazyUrl)).toBe(true);
    expect(env.locks!.held.map((lock) => lock.name).sort()).toEqual([
      `airborne:${NAMESPACE}:using:v1`,
      `airborne:${NAMESPACE}:using:v2`,
    ]);

    // Once no tab runs v1, the next commit prunes it.
    env.locks!.dropAll();
    const v3 = makeRelease({ version: 'v3' });
    env.serveRelease(v3);
    expect((await relaunch()).releaseConfig.package.version).toBe('v3');
    expect(packageCache('v1')).toBeUndefined();
    expect(packageCache('v2')).toBeUndefined();
  });

  it('does not commit a late download over a newer package', async () => {
    const v2 = makeRelease({ version: 'v2', bootTimeout: 10 });
    const index = v2.releaseConfig.package.index;
    env.serveRelease(v2);
    // The first tab's download of v2 stalls; later ones go through.
    const respond = serveFirstLater(
      index.url,
      '/* index v2 */',
      '/* index v2 */'
    );
    const firstTab = loader;
    expect((await boot()).pendingPackageVersion).toBe('v2');

    // A second tab installs and runs v2; a third installs v3.
    expect((await relaunch()).releaseConfig.package.version).toBe('v2');
    const v3 = makeRelease({ version: 'v3' });
    env.serveRelease(v3);
    expect((await relaunch()).releaseConfig.package.version).toBe('v3');

    // The first tab's v2 lands last. v3 stays.
    respond();
    await firstTab.__testing.whenSettled();
    expect(env.state().current.package.version).toBe('v3');
  });

  it('does not discard a package another tab is still downloading', async () => {
    const v2 = makeRelease({ version: 'v2', bootTimeout: 10 });
    const index = v2.releaseConfig.package.index;
    env.serveRelease(v2);
    // The first tab's download is slow; the second tab's fails.
    const respond = serveFirstLater(index.url, '/* index v2 */', 'down', 500);
    const firstTab = loader;
    expect((await boot()).pendingPackageVersion).toBe('v2');

    expect((await relaunch()).source).toBe('bundled');
    expect(packageCache('v2')).toBeDefined();

    respond();
    await firstTab.__testing.whenSettled();
    expect(env.state().current.package.version).toBe('v2');
    expect((await relaunch()).releaseConfig.package.version).toBe('v2');
  });

  it('does not delete a package a tab takes hold of while it is pruned', async () => {
    env.serveRelease(v1);
    await boot();
    await settle();
    // The tab running v1 closes.
    env.locks!.dropAll();

    // While the next commit prunes, a new tab takes its hold on v1.
    let held: Promise<unknown> | undefined;
    const keys = env.caches.keys.bind(env.caches);
    env.caches.keys = async () => {
      if (!held) {
        held = env.locks!.request(
          `airborne:${NAMESPACE}:using:v1`,
          { mode: 'shared' },
          () => new Promise<void>(() => {})
        );
      }
      return keys();
    };
    const v2 = makeRelease({ version: 'v2' });
    env.serveRelease(v2);
    expect((await relaunch()).releaseConfig.package.version).toBe('v2');
    expect(held).toBeDefined();
    expect(packageCache('v1')).toBeDefined();
  });

  it('does not prune a resource another tab cached but has not recorded', async () => {
    const a = cdnFile('a.json', 'a', 'r1');
    const b = cdnFile('b.json', 'b', 'r2');
    const c = cdnFile('c.json', 'c', 'r2');
    const config = { ...bundled.releaseConfig.config, boot_timeout: 10 };
    // The first tab downloads b and c: b lands, c takes its time.
    env.serveRelease({
      releaseConfig: { ...bundled.releaseConfig, config, resources: [b, c] },
      bodies: { [b.url]: 'b' },
    });
    const respondC = serveLater(c.url, 'c');
    const firstTab = loader;
    await boot();
    await until(() => resourceCache()?.entries.has(cacheKeyOf(b)) ?? false);

    // A second tab records a release that lists only a, then prunes.
    env.serveRelease({
      releaseConfig: { ...bundled.releaseConfig, resources: [a] },
      bodies: { [a.url]: 'a' },
    });
    await relaunch();
    expect(resourceCache()!.entries.has(cacheKeyOf(b))).toBe(true);

    respondC();
    await firstTab.__testing.whenSettled();
    expect(Object.keys(env.state().resources).sort()).toEqual([
      'b.json',
      'c.json',
    ]);
    expect([...resourceCache()!.entries.keys()].sort()).toEqual(
      [cacheKeyOf(b), cacheKeyOf(c)].sort()
    );
  });

  it('selects again when its package is pruned before the page holds it', async () => {
    env.serveRelease(v1);
    await boot();
    await settle();
    env.locks!.dropAll();

    // This tab is offline and selects v1. Before it holds v1, another tab
    // installs v2 and prunes v1.
    env.routes.clear();
    const v2 = makeRelease({ version: 'v2' });
    const locks = env.locks!;
    const request = locks.request.bind(locks) as (
      ...args: unknown[]
    ) => Promise<unknown>;
    let otherTab: Promise<unknown> | undefined;
    locks.request = (async (...args: unknown[]) => {
      if (!otherTab && args[0] === `airborne:${NAMESPACE}:using:v1`) {
        env.serveRelease(v2);
        otherTab = relaunch();
        await otherTab;
      }
      return request(...args);
    }) as typeof locks.request;
    load();
    const result = await boot();
    expect(otherTab).toBeDefined();
    expect(packageCache('v1')).toBeUndefined();
    expect(result.source).toBe('ota');
    expect(result.releaseConfig.package.version).toBe('v2');
  });

  it('releases the hold on a package the page stops running', async () => {
    env.serveRelease(v1);
    await boot();
    await settle();
    expect(env.locks!.held.map((lock) => lock.name)).toEqual([
      `airborne:${NAMESPACE}:using:v1`,
    ]);

    // The server goes back to the bundled package; this page boots again.
    env.serveRelease({ releaseConfig: bundled.releaseConfig });
    expect((await boot()).source).toBe('bundled');
    await settle();
    await new Promise((resolve) => setImmediate(resolve));
    expect(env.locks!.held).toEqual([]);
  });

  it('changes state only through fresh reads under the state lock', async () => {
    const violations = watchStateWrites(env);
    env.serveRelease({
      releaseConfig: { ...v1.releaseConfig, resources: [strings] },
      bodies: { ...v1.bodies, [strings.url]: '{"hi":1}' },
    });
    await boot();
    await settle();
    await relaunch();
    const v2 = makeRelease({ version: 'v2' });
    env.serveRelease(v2);
    await relaunch();
    load();
    await boot({ bundled: bundledRelease('bundled-2') });
    await settle();
    expect(env.state().bundledVersion).toBe('bundled-2');
    expect(violations).toEqual([]);
  });
});

describe('blob URLs', () => {
  it('reuses lazy blob URLs and revokes the previous runtime', async () => {
    env.serveRelease(v1);
    await boot();
    await settle();
    const firstRuntime = runtime();
    const firstUrls = [
      firstRuntime.bundlePath,
      ...Object.values(firstRuntime.files),
    ].filter((url) => url.startsWith('blob:'));

    await boot();
    await runtime().ready;
    const lazyUrl = runtime().files['lazy.png'];
    expect(lazyUrl).toMatch(/^blob:/);
    await settle();
    // The lazy download is a cache hit for the entry already mapped.
    expect(runtime().files['lazy.png']).toBe(lazyUrl);
    firstUrls.forEach((url) => expect(env.revokedBlobUrls.has(url)).toBe(true));

    const mapped = [runtime().bundlePath, ...Object.values(runtime().files)];
    expect([...env.liveBlobUrls.keys()].sort()).toEqual(
      mapped.filter((url) => url.startsWith('blob:')).sort()
    );
  });
});

/** A copy of `release` whose listed files carry `checksum` (none when undefined). */
function withChecksum<T extends { releaseConfig: any }>(
  release: T,
  filePaths: string[],
  checksum: string | undefined
): T {
  const copy = JSON.parse(JSON.stringify(release.releaseConfig));
  const { index, important, lazy } = copy.package;
  [index, ...important, ...lazy, ...copy.resources]
    .filter((file) => filePaths.includes(file.file_path))
    .forEach((file) => {
      if (checksum === undefined) {
        delete file.checksum;
      } else {
        file.checksum = checksum;
      }
    });
  return { ...release, releaseConfig: copy };
}

describe('releases without checksums', () => {
  const full = makeRelease({
    version: 'v2',
    important: { 'chunk.js': 'chunk v2' },
    lazy: { 'lazy.png': 'lazy v2' },
  });
  const urlOf = (release: typeof full, filePath: string) => {
    const { index, important, lazy } = release.releaseConfig.package;
    return [index, ...important, ...lazy].find(
      (file) => file.file_path === filePath
    )!.url;
  };

  it.each([
    ['an empty index checksum', ['index.js'], ''],
    ['a missing index checksum', ['index.js'], undefined],
    ['an empty important-file checksum', ['chunk.js'], ''],
    ['a missing important-file checksum', ['chunk.js'], undefined],
  ])(
    'refuses a package with %s and boots the bundled one',
    async (_name, filePaths, checksum) => {
      const events: AirborneBootEvent[] = [];
      env.serveRelease(withChecksum(full, filePaths, checksum));

      const result = await boot({ onEvent: (event) => events.push(event) });
      await settle();

      expect(result.source).toBe('bundled');
      expect(result.pendingPackageVersion).toBeUndefined();
      expect(result.bundlePath).toBe('https://app.example/static/index.js');
      expect(env.scripts).toEqual([result.bundlePath]);
      // Nothing of the package is fetched, cached or committed.
      expect(env.fetched).toEqual([RELEASE_URL]);
      expect(packageCache('v2')).toBeUndefined();
      expect(env.state()?.current ?? null).toBeNull();
      expect(events).toEqual([
        {
          type: 'error',
          message: expect.stringMatching(
            new RegExp(
              `refusing package v2.*no SHA-256 checksum.*${filePaths[0]}`
            )
          ),
          packageVersion: 'v2',
        },
      ]);
    }
  );

  it('boots the cached package instead of a refused newer one', async () => {
    const events: AirborneBootEvent[] = [];
    env.serveRelease(v1);
    await boot();
    await settle();

    env.serveRelease(withChecksum(full, ['chunk.js'], ''));
    env.fetched.length = 0;
    const result = await boot({ onEvent: (event) => events.push(event) });
    await settle();

    expect(result.source).toBe('ota');
    expect(result.releaseConfig.package.version).toBe('v1');
    expect(await api.getFileContent(NAMESPACE, 'chunk.js')).toBe('chunk v1');
    expect(env.fetched).not.toContain(urlOf(full, 'chunk.js'));
    expect(env.state().current.package.version).toBe('v1');
    expect(events).toEqual([
      expect.objectContaining({
        type: 'error',
        message: expect.stringContaining('refusing package v2'),
        packageVersion: 'v2',
      }),
    ]);
  });

  it('never runs a cached file that has no checksum, whatever its URL holds', async () => {
    env.serveRelease(v1);
    await boot();
    await settle();

    // A release saved without the checksum, and bytes cached under the bare URL.
    const state = env.state();
    delete state.current.package.important[0].checksum;
    env.storage.setItem(`airborne:${NAMESPACE}:state`, JSON.stringify(state));
    const chunk = state.current.package.important[0];
    await packageCache('v1')!.put(cacheKeyOf(chunk), new Response('evil'));

    env.routes.clear();
    const offline = await relaunch();
    expect(offline.source).toBe('bundled');
    expect(runtime().files['chunk.js']).toBe(
      'https://app.example/static/chunk.js'
    );
    expect(
      [...env.liveBlobUrls.values()].map((blob) => blob.size)
    ).not.toContain(4);
  });

  it('does not reuse a cached copy of a file without a checksum by URL alone', async () => {
    const events: AirborneBootEvent[] = [];
    const strings = { file_path: 'strings.json', url: `${CDN}/strings.json` };
    const release = makeRelease({ version: 'v1', resources: [strings] });
    env.serveRelease(release);
    await resourceCache(); // not created yet
    await env.caches.open(`airborne:${NAMESPACE}:resources`);
    await resourceCache()!.put(cacheKeyOf(strings), new Response('stale'));

    const result = await boot({ onEvent: (event) => events.push(event) });
    await settle();

    expect(result.source).toBe('ota');
    // Neither fetched nor served from the cached entry.
    expect(env.fetched).not.toContain(strings.url);
    expect(runtime().files['strings.json']).toBe(
      'https://app.example/static/strings.json'
    );
    expect(env.state().resources ?? {}).toEqual({});
    expect(events).toEqual([
      expect.objectContaining({
        type: 'error',
        message: expect.stringMatching(
          /resource.*strings\.json.*no SHA-256 checksum/
        ),
      }),
    ]);
  });

  it('refuses a lazy file without a checksum but boots the package', async () => {
    const events: AirborneBootEvent[] = [];
    env.serveRelease(withChecksum(full, ['lazy.png'], ''));

    const result = await boot({ onEvent: (event) => events.push(event) });
    await settle();

    expect(result.source).toBe('ota');
    expect(await api.getFileContent(NAMESPACE, 'chunk.js')).toBe('chunk v2');
    expect(env.fetched).not.toContain(urlOf(full, 'lazy.png'));
    await expect(api.getFileUrl(NAMESPACE, 'lazy.png')).resolves.toBeNull();
    expect(events).toEqual([
      {
        type: 'error',
        message: expect.stringMatching(
          /package v2 failed.*lazy\.png.*checksum/
        ),
        packageVersion: 'v2',
      },
    ]);
  });

  it("does not check the page's own bundled files", async () => {
    const events: AirborneBootEvent[] = [];
    const unchecked = withChecksum(
      bundledRelease(),
      ['index.js', 'chunk.js', 'lazy.png'],
      undefined
    );

    // No release served at all: the bundled package runs.
    const offline = await boot({
      bundled: unchecked,
      onEvent: (event) => events.push(event),
    });
    expect(offline.source).toBe('bundled');
    expect(env.scripts).toEqual(['https://app.example/static/index.js']);

    // The server serves the bundled version itself, also without checksums.
    env.serveRelease({
      releaseConfig: { ...unchecked.releaseConfig, resources: [] },
    });
    const served = await boot({
      bundled: unchecked,
      onEvent: (event) => events.push(event),
    });
    await settle();
    expect(served.source).toBe('bundled');
    expect(events).toEqual([]);
  });
});

describe('web entry', () => {
  it('exposes only the public API', () => {
    const entry = require('../web');
    expect(Object.keys(entry)).toEqual(['bootAirborne']);
    const manifest = require('../../package.json');
    expect(manifest.exports['./web']).toEqual({
      types: './lib/typescript/src/web/index.d.ts',
      default: './lib/module/web/index.js',
    });
  });
});
