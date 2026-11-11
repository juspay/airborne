/** @jest-environment node */
import { bootAirborne, markBootSuccess, __testing } from '../web/loader';
import { bundledRelease, installWebEnvironment, makeRelease, NAMESPACE, RELEASE_URL } from './support/webEnvironment';
import type { WebEnvironment } from './support/webEnvironment';
let env: WebEnvironment;
beforeEach(() => { env = installWebEnvironment(); });
async function boot(guard = false) {
  const result = await bootAirborne({ namespace: NAMESPACE, releaseConfigUrl: RELEASE_URL,
    bundled: bundledRelease(), bootGuardEnabled: guard });
  await __testing.whenSettled();
  if (result.source === 'ota' && guard) await markBootSuccess(NAMESPACE);
  return result;
}
it('persists exclusions and refuses cached current and last-good packages with the guard off', async () => {
  const good = makeRelease({ version: 'good' });
  env.serveRelease(good);
  expect((await boot(true)).releaseConfig.package.version).toBe('good');
  const bad = makeRelease({ version: 'bad' });
  env.serveRelease({ ...bad, releaseConfig: { ...bad.releaseConfig, blocked_package_versions: ['good', 'bad'] } });
  expect((await boot()).source).toBe('bundled');
  expect(env.state().blocked).toEqual(['good', 'bad']);
  env.routes.clear();
  expect((await boot()).source).toBe('bundled');
  expect(env.state().blocked).toEqual(['good', 'bad']);
});
it('does not clear security exclusions when a host deploy changes', async () => {
  const bad = makeRelease({ version: 'bad' });
  env.serveRelease({ ...bad, releaseConfig: { ...bad.releaseConfig, blocked_package_versions: ['bad'] } });
  expect((await boot()).source).toBe('bundled');
  const state = env.state();
  env.storage.setItem(`airborne:${NAMESPACE}:state`, JSON.stringify({ ...state, bundledVersion: 'previous-host' }));
  env.serveRelease(bad);
  expect((await boot()).source).toBe('bundled');
  expect(env.state().blocked).toEqual(['bad']);
});
