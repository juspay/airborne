/** @jest-environment node */
import type { AirborneBootEvent, AirborneWebOptions } from '../web/types';
import {
  NAMESPACE,
  RELEASE_URL,
  bundledRelease,
  installWebEnvironment,
  makeRelease,
  sha256,
  watchStateWrites,
  type WebEnvironment,
} from './support/webEnvironment';

type Loader = typeof import('../web/loader');

/** Where the loader keeps this page's boot sessions (shared by its copies). */
const SESSIONS = '__AIRBORNE_BOOT__';

interface Session {
  version: string;
  end(): void;
}
type Sessions = Record<string, Session> | undefined;

const host = globalThis as unknown as Record<string, Sessions>;

/** Makes `sessions` the current page's, as the loader would see them. */
function enterPage(sessions: Sessions) {
  delete host[SESSIONS];
  if (sessions) {
    Object.defineProperty(globalThis, SESSIONS, {
      value: sessions,
      configurable: true,
    });
  }
}

let env: WebEnvironment;
let events: AirborneBootEvent[];
let pages: Sessions[];

beforeEach(() => {
  env = installWebEnvironment();
  events = [];
  pages = [];
  enterPage(undefined);
});

afterEach(() => {
  // Clears the boot window timers and releases the booting locks.
  pages.forEach((sessions) =>
    Object.values(sessions ?? {}).forEach((session) => session.end())
  );
  enterPage(undefined);
});

/** Lets lock releases, which finish asynchronously, take effect. */
function nextMacrotask() {
  return new Promise((resolve) => setImmediate(resolve));
}

function loadLoader(): Loader {
  let loader: Loader | undefined;
  jest.isolateModules(() => {
    loader = require('../web/loader');
  });
  return loader as Loader;
}

function options(
  overrides: Partial<AirborneWebOptions> = {}
): AirborneWebOptions {
  return {
    releaseConfigUrl: RELEASE_URL,
    namespace: NAMESPACE,
    bundled: bundledRelease(),
    bootGuardEnabled: true,
    onEvent: (event) => events.push(event),
    ...overrides,
  };
}

/**
 * One page load in a new tab: a fresh copy of the loader module and a fresh
 * window against the shared storage, caches and locks. Earlier tabs stay open
 * (their locks stay held) unless the test drops them.
 */
async function launch(overrides: Partial<AirborneWebOptions> = {}) {
  enterPage(undefined);
  const loader = loadLoader();
  const result = await loader.bootAirborne(options(overrides));
  await loader.__testing.whenSettled();
  const sessions = host[SESSIONS];
  pages.push(sessions);
  return {
    result,
    loader,
    version: result.releaseConfig.package.version,
    /** markBootSuccess() called from this page. */
    ack: () => {
      enterPage(sessions);
      return loader.markBootSuccess(NAMESPACE);
    },
  };
}

const guard = () => env.state()?.guard;

const releaseA = makeRelease({ version: 'A', important: { 'chunk.js': 'A' } });
const releaseL = makeRelease({ version: 'L', important: { 'chunk.js': 'L' } });

/** Installs and acknowledges L, then serves A and lets it fail to acknowledge twice. */
async function blockAWithLastGood() {
  env.serveRelease(releaseL);
  await (await launch()).ack();
  env.serveRelease(releaseA);
  expect((await launch()).version).toBe('A');
  expect((await launch()).version).toBe('A');
}

it('rolls back a package after two unacknowledged boots', async () => {
  env.serveRelease(releaseA);
  const first = await launch();
  expect(first.result.source).toBe('ota');
  expect(guard()).toMatchObject({ pending: 'A', attempts: 1 });
  await launch();
  expect(guard()).toMatchObject({ pending: 'A', attempts: 2 });

  const third = await launch();
  expect(events).toEqual([
    { type: 'rollback', packageVersion: 'A' },
    { type: 'blocked-package', packageVersion: 'A' },
  ]);
  expect(third.result.source).toBe('bundled');
  expect(guard()).toMatchObject({ blocked: 'A', attempts: 0 });
  expect(guard().pending).toBeUndefined();
});

it('falls back to the last acknowledged package', async () => {
  await blockAWithLastGood();

  const fallback = await launch();
  expect(fallback.result.source).toBe('ota');
  expect(fallback.version).toBe('L');
  expect(guard()).toMatchObject({ blocked: 'A', pending: 'L', attempts: 1 });
  await fallback.ack();

  // An acknowledged fallback keeps running while the server still serves A.
  for (let boot = 0; boot < 3; boot++) {
    const next = await launch();
    expect(next.version).toBe('L');
    expect(guard()).toMatchObject({ blocked: 'A', pending: 'L', attempts: 1 });
    await next.ack();
    expect(guard().pending).toBeUndefined();
    expect(guard().attempts).toBe(0);
    expect(guard().lastGood.package.version).toBe('L');
  }
  expect(events).not.toContainEqual({ type: 'rollback', packageVersion: 'L' });
});

it('falls back to the bundled package when nothing was acknowledged', async () => {
  env.serveRelease(releaseA);
  await launch();
  await launch();
  const result = await launch();
  expect(result.result.source).toBe('bundled');
  expect(result.version).toBe('bundled-1');
});

it('keeps the block while a newer package has not installed', async () => {
  env.serveRelease(releaseA);
  await launch();
  await launch();
  await launch();
  expect(guard().blocked).toBe('A');

  const releaseB = makeRelease({
    version: 'B',
    important: { 'chunk.js': 'B' },
    bootTimeout: 10,
  });
  env.serveRelease(releaseB);
  env.stall(releaseB.releaseConfig.package.index.url);
  // Not settled: the stalled download never finishes.
  enterPage(undefined);
  const stalled = await loadLoader().bootAirborne(options());
  expect(stalled.source).toBe('bundled');
  expect(guard().blocked).toBe('A');

  env.serve(releaseB.releaseConfig.package.index.url, 'nope', 500);
  const failed = await launch();
  expect(failed.result.source).toBe('bundled');
  expect(guard().blocked).toBe('A');

  env.serveRelease(releaseB);
  const installed = await launch();
  expect(installed.version).toBe('B');
  expect(guard().blocked).toBeUndefined();
});

it('drops a failing last-good package instead of bouncing between two', async () => {
  await blockAWithLastGood();
  expect((await launch()).version).toBe('L');
  expect((await launch()).version).toBe('L');

  const next = await launch();
  expect(next.result.source).toBe('bundled');
  expect(guard().blocked).toBe('A');
  expect(guard().lastGood).toBeUndefined();
  expect(events).toContainEqual({ type: 'rollback', packageVersion: 'L' });

  for (let boot = 0; boot < 3; boot++) {
    expect((await launch()).result.source).toBe('bundled');
  }
});

it('never rolls back acknowledged boots', async () => {
  env.serveRelease(releaseA);
  for (let boot = 0; boot < 4; boot++) {
    const launched = await launch();
    expect(launched.version).toBe('A');
    await launched.ack();
    expect(guard().pending).toBeUndefined();
    expect(guard().attempts).toBe(0);
  }
  expect(guard().lastGood.package.version).toBe('A');
  expect(events).toEqual([]);
});

it('resets when the host page is redeployed', async () => {
  await blockAWithLastGood();
  await launch();

  const redeployed = await launch({ bundled: bundledRelease('bundled-2') });
  expect(redeployed.version).toBe('A');
  expect(guard()).toEqual({ binary: 'bundled-2', pending: 'A', attempts: 1 });
});

/**
 * Lists every state write that puts a guard into state of another host
 * deploy than the guard's.
 */
function watchForeignGuardWrites(): unknown[] {
  const key = `airborne:${NAMESPACE}:state`;
  const foreign: unknown[] = [];
  const setItem = env.storage.setItem.bind(env.storage);
  env.storage.setItem = (name: string, value: string) => {
    const state = name === key ? JSON.parse(value) : null;
    if (state?.guard && state.guard.binary !== state.bundledVersion) {
      foreign.push(state);
    }
    setItem(name, value);
  };
  return foreign;
}

/**
 * Boots the redeployed page (guard off) in a new tab, from inside a hook. Its
 * events are its own.
 */
function bootRedeployedTab(): Promise<unknown> {
  enterPage(undefined);
  const loader = loadLoader();
  const redeployed = options({
    bundled: bundledRelease('bundled-2'),
    bootGuardEnabled: false,
    onEvent: () => {},
  });
  return loader
    .bootAirborne(redeployed)
    .then(() => loader.__testing.whenSettled());
}

it('does not acknowledge into the state of a newer host deploy', async () => {
  env.serveRelease(releaseA);
  const oldTab = await launch();
  expect(guard()).toMatchObject({ binary: 'bundled-1', pending: 'A' });

  // The page is redeployed; its first launch boots A as well.
  await launch({ bundled: bundledRelease('bundled-2') });
  expect(guard()).toEqual({ binary: 'bundled-2', pending: 'A', attempts: 1 });

  // The old tab's acknowledgement is about its own deploy's boot.
  await oldTab.ack();
  expect(guard()).toEqual({ binary: 'bundled-2', pending: 'A', attempts: 1 });
});

it('ignores a guard it cannot discard while the guard is off', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  await blockAWithLastGood();
  await launch();
  expect(guard()).toMatchObject({ blocked: 'A' });

  env.storage.failWrites = true;
  const off = await launch({ bootGuardEnabled: false });
  expect(guard()).toMatchObject({ blocked: 'A' });
  expect(off.version).toBe('A');
  warn.mockRestore();
});

it('discards guard state while the guard is off', async () => {
  env.serveRelease(releaseA);
  await launch();
  await launch();
  await launch();
  expect(guard().blocked).toBe('A');

  const off = await launch({ bootGuardEnabled: false });
  expect(off.version).toBe('A');
  expect(guard()).toBeUndefined();
  await off.ack();
  expect(guard()).toBeUndefined();

  const on = await launch();
  expect(on.version).toBe('A');
  expect(guard()).toMatchObject({ pending: 'A', attempts: 1 });
});

it('never tracks bundled boots', async () => {
  const launched = await launch();
  expect(launched.result.source).toBe('bundled');
  await launched.ack();
  await launch();
  await launch();
  expect(guard()?.pending).toBeUndefined();
  expect(events).toEqual([]);
});

it('keeps booting when guard state cannot be saved', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  env.serveRelease(releaseA);
  await launch();
  env.storage.failWrites = true;
  const launched = await launch();
  expect(launched.version).toBe('A');
  expect(env.scripts).toHaveLength(2);
  await expect(launched.ack()).resolves.toBeUndefined();
  expect(events).toEqual([
    { type: 'error', message: expect.stringMatching(/could not save/) },
  ]);
  warn.mockRestore();
});

/**
 * Installs A, then boots it in a tab where B misses the boot timeout and
 * commits right after. Resolves to that tab's markBootSuccess().
 */
async function runAWhileBCommits() {
  env.serveRelease(releaseA);
  await launch();
  env.locks?.dropAll();
  const releaseB = makeRelease({
    version: 'B',
    important: { 'chunk.js': 'B' },
    bootTimeout: 10,
  });
  env.serveRelease(releaseB);
  const indexUrl = releaseB.releaseConfig.package.index.url;
  let respond = () => {};
  env.routes.set(
    indexUrl,
    () =>
      new Promise<Response>((resolve) => {
        respond = () => resolve(new Response(releaseB.bodies[indexUrl]));
      })
  );

  enterPage(undefined);
  const loader = loadLoader();
  const result = await loader.bootAirborne(options());
  const sessions = host[SESSIONS];
  pages.push(sessions);
  expect(result.releaseConfig.package.version).toBe('A');
  respond();
  await loader.__testing.whenSettled();
  expect(env.state().current.package.version).toBe('B');
  return () => {
    enterPage(sessions);
    return loader.markBootSuccess(NAMESPACE);
  };
}

it('does not record a last good package whose cache was pruned', async () => {
  // Without Web Locks, nothing tells the commit of B that A is still running.
  const ack = await runAWhileBCommits();
  expect(env.caches.caches.has(`airborne:${NAMESPACE}:package:A`)).toBe(false);

  await ack();
  expect(guard().pending).toBeUndefined();
  expect(guard().attempts).toBe(0);
  expect(guard().lastGood).toBeUndefined();
  expect(events).toEqual([
    {
      type: 'error',
      message: expect.stringMatching(/cached files are gone/),
      packageVersion: 'A',
    },
  ]);
});

it('does not let the bundled fallback acknowledge an OTA package that could not run', async () => {
  env = installWebEnvironment({ locks: true });
  env.serveRelease(releaseA);
  // A Content-Security-Policy whose script-src does not allow blob: URLs.
  env.scriptFails = (src) => src.startsWith('blob:');

  const launched = await launch();
  expect(launched.result.source).toBe('bundled');
  expect(events).toEqual([
    { type: 'error', message: expect.any(String), packageVersion: 'A' },
  ]);
  expect(guard()).toMatchObject({ pending: 'A', attempts: 1 });
  await nextMacrotask();
  expect(env.locks!.held).toEqual([]);

  await launched.ack();
  expect(guard()).toMatchObject({ pending: 'A', attempts: 1 });
  expect(guard().lastGood).toBeUndefined();
});

it('boots and acknowledges a namespace named like an object property', async () => {
  env.serveRelease(releaseA);
  const loader = loadLoader();
  const result = await loader.bootAirborne(
    options({ namespace: 'constructor' })
  );
  await loader.__testing.whenSettled();
  pages.push(host[SESSIONS]);
  expect(result.source).toBe('ota');
  expect(env.scripts).toEqual([result.bundlePath]);
  await expect(loader.markBootSuccess('constructor')).resolves.toBeUndefined();
  await expect(loader.markBootSuccess('toString')).rejects.toThrow(
    /has not booted/
  );
});

describe('markBootSuccess', () => {
  it('acknowledges from the OTA bundle’s own copy of the loader', async () => {
    env = installWebEnvironment({ locks: true });
    env.serveRelease(releaseA);
    const hostCopy = loadLoader();
    await hostCopy.bootAirborne(options());
    await hostCopy.__testing.whenSettled();
    pages.push(host[SESSIONS]);
    expect(guard()).toMatchObject({ pending: 'A', attempts: 1 });
    expect(env.locks!.held.map((lock) => lock.name)).toContain(
      `airborne:${NAMESPACE}:booting:A`
    );

    const bundleCopy = loadLoader();
    expect(bundleCopy).not.toBe(hostCopy);
    await bundleCopy.markBootSuccess(NAMESPACE);
    await nextMacrotask();
    expect(guard().pending).toBeUndefined();
    expect(guard().attempts).toBe(0);
    expect(guard().lastGood.package.version).toBe('A');
    // The host's booting lock is released with the acknowledgement; the page
    // still runs A.
    expect(env.locks!.held).toEqual([
      { name: `airborne:${NAMESPACE}:using:A`, mode: 'shared' },
    ]);
  });

  it('rejects for a namespace that has not booted', async () => {
    const loader = loadLoader();
    await expect(loader.markBootSuccess(NAMESPACE)).rejects.toThrow(
      /has not booted/
    );
  });

  it('resolves when the page booted without a tracked boot', async () => {
    const bundledBoot = await launch();
    expect(bundledBoot.result.source).toBe('bundled');
    await expect(bundledBoot.ack()).resolves.toBeUndefined();

    env.serveRelease(releaseA);
    const guardOff = await launch({ bootGuardEnabled: false });
    expect(guardOff.version).toBe('A');
    await expect(guardOff.ack()).resolves.toBeUndefined();
    expect(guard()).toBeUndefined();
  });
});

it('counts a page that boots the same package twice once', async () => {
  env.serveRelease(releaseA);
  await launch();
  const page = await launch();
  expect(guard()).toMatchObject({ pending: 'A', attempts: 2 });

  // Booting again in the same page neither counts nor rolls back.
  enterPage(host[SESSIONS]);
  const again = await page.loader.bootAirborne(options());
  expect(again.releaseConfig.package.version).toBe('A');
  expect(guard()).toMatchObject({ pending: 'A', attempts: 2 });
  expect(events).toEqual([]);

  await page.ack();
  expect(guard().pending).toBeUndefined();
});

describe('with navigator.locks', () => {
  beforeEach(() => {
    env = installWebEnvironment({ locks: true });
  });

  it('does not count a tab joining another live boot of the same package', async () => {
    env.serveRelease(releaseA);
    const firstTab = await launch();
    expect(guard()).toMatchObject({ pending: 'A', attempts: 1 });

    const secondTab = await launch();
    const thirdTab = await launch();
    expect(secondTab.version).toBe('A');
    expect(thirdTab.version).toBe('A');
    expect(guard()).toMatchObject({ pending: 'A', attempts: 1 });

    await firstTab.ack();
    expect(guard().pending).toBeUndefined();
    await secondTab.ack();
    await thirdTab.ack();
    expect(events).toEqual([]);
  });

  it('counts boots once earlier tabs have closed', async () => {
    env.serveRelease(releaseA);
    await launch();
    env.locks!.dropAll();
    await launch();
    expect(guard()).toMatchObject({ pending: 'A', attempts: 2 });
    env.locks!.dropAll();

    const next = await launch();
    expect(next.result.source).toBe('bundled');
    expect(guard().blocked).toBe('A');
  });

  it('counts again once a stuck tab’s boot window has passed', async () => {
    const timers = jest.spyOn(globalThis, 'setTimeout');
    env.serveRelease(releaseA);
    const stuck = await launch();
    expect(guard()).toMatchObject({ pending: 'A', attempts: 1 });

    // The stuck tab stays open but never acknowledges.
    const { bootWindowMs } = stuck.loader.__testing;
    const windowTimer = timers.mock.calls.find(
      (call) => call[1] === bootWindowMs
    );
    timers.mockRestore();
    expect(windowTimer).toBeDefined();
    (windowTimer![0] as () => void)();
    await nextMacrotask();
    expect(env.locks!.held.map((lock) => lock.name)).toEqual([
      `airborne:${NAMESPACE}:using:A`,
    ]);

    await launch();
    expect(guard()).toMatchObject({ pending: 'A', attempts: 2 });
  });

  it('defers a rollback while another tab is still booting the package', async () => {
    env.serveRelease(releaseA);
    await launch();
    env.locks!.dropAll();
    const live = await launch();
    expect(guard()).toMatchObject({ pending: 'A', attempts: 2 });

    // `live` may still acknowledge A, so this launch does not roll it back.
    const joining = await launch();
    expect(joining.version).toBe('A');
    expect(guard()).toMatchObject({ pending: 'A', attempts: 2 });
    expect(events).toEqual([]);

    await live.ack();
    expect(guard().pending).toBeUndefined();
    expect(guard().blocked).toBeUndefined();
  });

  /** Runs `during` the first time a launch asks which locks are held. */
  function onFirstLockQuery(during: () => void) {
    const locks = env.locks!;
    const query = locks.query.bind(locks);
    let ran = false;
    locks.query = async () => {
      if (!ran) {
        ran = true;
        during();
      }
      return query();
    };
  }

  /** A second unacknowledged boot of A, from a tab that stays open. */
  async function liveSecondBootOfA() {
    env.serveRelease(releaseA);
    await launch();
    env.locks!.dropAll();
    const live = await launch();
    expect(guard()).toMatchObject({ pending: 'A', attempts: 2 });
    return live;
  }

  it('keeps an acknowledgement made while a rollback is being decided', async () => {
    const live = await liveSecondBootOfA();

    // The live tab acknowledges while the next launch checks whether A is
    // still booting.
    let acknowledged: Promise<void> | undefined;
    onFirstLockQuery(() => {
      acknowledged = live.ack();
      enterPage(undefined);
    });
    const next = await launch();
    await acknowledged;
    expect(acknowledged).toBeDefined();
    expect(next.version).toBe('A');
    expect(guard().blocked).toBeUndefined();
    expect(guard().lastGood.package.version).toBe('A');
    expect(events).toEqual([]);
  });

  it('acknowledges before releasing the booting lock', async () => {
    const live = await liveSecondBootOfA();

    // The live tab acknowledges while the next launch, holding the guard
    // lock, is about to ask whether A is still booting.
    const locks = env.locks!;
    const query = locks.query.bind(locks);
    let acknowledged: Promise<void> | undefined;
    locks.query = async () => {
      if (!acknowledged) {
        acknowledged = live.ack();
        enterPage(undefined);
        await nextMacrotask();
      }
      return query();
    };
    const next = await launch();
    await acknowledged;
    expect(next.version).toBe('A');
    // Not rolled back. (`next` itself counts a new boot of A.)
    expect(guard().blocked).toBeUndefined();
    expect(guard().lastGood.package.version).toBe('A');
    expect(events).toEqual([]);
  });

  it('keeps an acknowledgement another tab saves while resources are recorded', async () => {
    const key = `airborne:${NAMESPACE}:state`;
    env.serveRelease(releaseA);
    await launch();
    expect(guard()).toMatchObject({ pending: 'A', attempts: 1 });

    // The next launch records a resource. While it reads the state to do so,
    // the first tab's acknowledgement is saved, under the state lock as the
    // loader does.
    const strings = {
      file_path: 'strings.json',
      url: 'https://cdn.example/r1/strings.json',
      checksum: sha256('{}'),
    };
    env.serveRelease({
      releaseConfig: { ...releaseA.releaseConfig, resources: [strings] },
      bodies: { ...releaseA.bodies, [strings.url]: '{}' },
    });
    let acknowledged: Promise<unknown> | undefined;
    const getItem = env.storage.getItem.bind(env.storage);
    // Right after the read, as another process could.
    env.storage.getItem = (name: string) => {
      const value = getItem(name);
      if (!acknowledged && name === key && env.fetched.includes(strings.url)) {
        acknowledged = env.locks!.request(key, () => {
          const state = JSON.parse(getItem(key)!);
          state.guard = {
            ...state.guard,
            pending: undefined,
            attempts: 0,
            lastGood: releaseA.releaseConfig,
          };
          env.storage.setItem(key, JSON.stringify(state));
        });
      }
      return value;
    };
    await launch();
    await acknowledged;

    expect(acknowledged).toBeDefined();
    expect(Object.keys(env.state().resources)).toEqual(['strings.json']);
    // The acknowledgement survived. (The launch itself then counted its own
    // boot of A, since A was no longer pending.)
    expect(guard().lastGood.package.version).toBe('A');
  });

  it('keeps a running package that acknowledges after a newer one commits', async () => {
    const ack = await runAWhileBCommits();
    expect(env.caches.caches.has(`airborne:${NAMESPACE}:package:A`)).toBe(true);

    await ack();
    expect(guard().pending).toBeUndefined();
    expect(guard().lastGood.package.version).toBe('A');
    expect(events).toEqual([]);
  });

  it('does not count a boot into the state of a newer host deploy', async () => {
    env.serveRelease(releaseA);
    await (await launch({ bootGuardEnabled: false })).ack();
    env.locks!.dropAll();
    const foreign = watchForeignGuardWrites();

    // Once this tab has selected A (it takes its hold on A), the page is
    // redeployed and a tab of the new deploy adopts the state.
    let redeployed: Promise<unknown> | undefined;
    const locks = env.locks!;
    const request = locks.request.bind(locks) as (
      ...args: unknown[]
    ) => Promise<unknown>;
    locks.request = ((...args: unknown[]) => {
      if (!redeployed && args[0] === `airborne:${NAMESPACE}:using:A`) {
        redeployed = bootRedeployedTab();
      }
      return request(...args);
    }) as typeof locks.request;
    const oldTab = await launch();
    await redeployed;
    expect(redeployed).toBeDefined();
    expect(oldTab.version).toBe('A');
    expect(env.state().bundledVersion).toBe('bundled-2');
    expect(foreign).toEqual([]);
  });

  it('does not roll back in the state of a newer host deploy', async () => {
    await liveSecondBootOfA();
    env.locks!.dropAll();
    const foreign = watchForeignGuardWrites();

    // While this launch decides on rolling A back, the page is redeployed
    // and a tab of the new deploy adopts the state.
    let redeployed: Promise<unknown> | undefined;
    onFirstLockQuery(() => {
      redeployed = bootRedeployedTab();
    });
    const oldTab = await launch();
    await redeployed;
    expect(redeployed).toBeDefined();
    expect(oldTab.result.source).toBe('bundled');
    expect(env.state().bundledVersion).toBe('bundled-2');
    expect(events).toEqual([]);
    expect(foreign).toEqual([]);
  });

  it('neither counts nor keeps as last good a package blocked after it was selected', async () => {
    env.serveRelease(releaseL);
    await (await launch()).ack();
    env.locks!.dropAll();
    const live = await liveSecondBootOfA();

    // This tab defers the rollback (A is still booting in `live`) and
    // selects A. As it takes its hold on A, `live` closes and another tab
    // rolls A back.
    const locks = env.locks!;
    const request = locks.request.bind(locks) as (
      ...args: unknown[]
    ) => Promise<unknown>;
    let blocking: Promise<unknown> | undefined;
    locks.request = (async (...args: unknown[]) => {
      if (!blocking && args[0] === `airborne:${NAMESPACE}:using:A`) {
        locks.dropAll();
        blocking = launch();
        await blocking;
      }
      return request(...args);
    }) as typeof locks.request;
    const late = await launch();
    expect(blocking).toBeDefined();
    expect(late.version).toBe('A');
    expect(live.version).toBe('A');
    // Only the rolling-back tab's own boot, of the fallback L, is counted.
    expect(guard()).toMatchObject({ blocked: 'A', pending: 'L', attempts: 1 });

    await late.ack();
    expect(guard()).toMatchObject({ blocked: 'A', pending: 'L', attempts: 1 });
    expect(guard().lastGood.package.version).toBe('L');
    locks.request = request as typeof locks.request;
    locks.dropAll();
    expect((await launch()).version).toBe('L');
  });

  it('keeps an acknowledgement after another tab booted a newer package', async () => {
    env.serveRelease(releaseA);
    const tabA = await launch();
    const releaseB = makeRelease({
      version: 'B',
      important: { 'chunk.js': 'B' },
    });
    env.serveRelease(releaseB);
    expect((await launch()).version).toBe('B');
    expect(guard()).toMatchObject({ pending: 'B', attempts: 1 });

    await tabA.ack();
    // A becomes last good; B's boot is still unacknowledged.
    expect(guard()).toMatchObject({ pending: 'B', attempts: 1 });
    expect(guard().lastGood.package.version).toBe('A');
    expect(events).toEqual([]);
  });

  it('keeps state other tabs save while a rollback is being decided', async () => {
    await liveSecondBootOfA();
    const key = `airborne:${NAMESPACE}:state`;
    const writes: any[] = [];
    // Another tab commits L meanwhile.
    onFirstLockQuery(() => {
      const state = env.state();
      env.storage.data.set(
        key,
        JSON.stringify({ ...state, current: releaseL.releaseConfig })
      );
      const setItem = env.storage.setItem.bind(env.storage);
      env.storage.setItem = (name: string, value: string) => {
        writes.push(JSON.parse(value));
        setItem(name, value);
      };
    });
    await launch();
    // The guard's write, the first after the commit, keeps it.
    expect(writes[0].current.package.version).toBe('L');
    expect(writes[0].guard).toMatchObject({ pending: 'A', attempts: 2 });
  });

  it('counts and acknowledges boots only inside the guard lock', async () => {
    const key = `airborne:${NAMESPACE}:state`;
    const outsideLock: unknown[] = [];
    const counts = (state: any) =>
      JSON.stringify([state?.guard?.pending, state?.guard?.attempts]);
    const setItem = env.storage.setItem.bind(env.storage);
    env.storage.setItem = (name: string, value: string) => {
      const locked = env.locks!.held.some(
        (lock) => lock.name === `airborne:${NAMESPACE}:guard`
      );
      if (name === key && counts(env.state()) !== counts(JSON.parse(value))) {
        if (!locked) {
          outsideLock.push(JSON.parse(value).guard);
        }
      }
      setItem(name, value);
    };

    const stale = watchStateWrites(env);

    env.serveRelease(releaseA);
    await (await launch()).ack();
    for (let boot = 0; boot < 3; boot++) {
      env.locks!.dropAll();
      await launch();
    }
    expect(guard().blocked).toBe('A');
    expect(outsideLock).toEqual([]);
    expect(stale).toEqual([]);
  });
});
