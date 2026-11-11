type Api = typeof import('../index');

const LINKING_ERROR = /doesn't seem to be linked/;

/** Loads src/index.tsx against a mocked react-native. */
function loadWith(turboModuleRegistry: unknown): Api {
  let api: Api | undefined;
  jest.isolateModules(() => {
    jest.doMock('react-native', () => ({
      TurboModuleRegistry: turboModuleRegistry,
      Platform: {
        select: (choices: { ios?: string; default?: string }) =>
          choices.default,
      },
    }));
    api = require('../index');
  });
  return api as Api;
}

afterEach(() => {
  jest.dontMock('react-native');
});

describe('with the native module linked', () => {
  const native = {
    readReleaseConfig: jest.fn(async () => '{"version":"1"}'),
    getFileContent: jest.fn(async () => 'content'),
    getBundlePath: jest.fn(async () => '/data/index.bundle'),
    markBootSuccess: jest.fn(async () => undefined),
  };
  const registry = { get: jest.fn(() => native) };
  let api: Api;

  beforeEach(() => {
    jest.clearAllMocks();
    api = loadWith(registry);
  });

  it('looks the module up as Airborne', () => {
    expect(registry.get).toHaveBeenCalledWith('Airborne');
    expect(api.default).toBe(native);
  });

  it('forwards every call to the native module', async () => {
    await expect(api.readReleaseConfig('shop')).resolves.toBe(
      '{"version":"1"}'
    );
    expect(native.readReleaseConfig).toHaveBeenCalledWith('shop');

    await expect(api.getFileContent('shop', 'a.json')).resolves.toBe('content');
    expect(native.getFileContent).toHaveBeenCalledWith('shop', 'a.json');

    await expect(api.getBundlePath('shop')).resolves.toBe('/data/index.bundle');
    expect(native.getBundlePath).toHaveBeenCalledWith('shop');
  });

  it('forwards markBootSuccess with the namespace', async () => {
    await expect(api.markBootSuccess('shop')).resolves.toBeUndefined();
    expect(native.markBootSuccess).toHaveBeenCalledWith('shop');
  });
});

describe('without the native module', () => {
  it('throws the linking error on call, not on import', () => {
    const api = loadWith({ get: () => null });
    expect(() => api.readReleaseConfig('shop')).toThrow(LINKING_ERROR);
    expect(() => api.getBundlePath('shop')).toThrow(LINKING_ERROR);
  });

  it('rejects markBootSuccess instead of throwing', async () => {
    const unlinked = loadWith({ get: () => null });
    let call: Promise<void> | undefined;
    expect(() => {
      call = unlinked.markBootSuccess('shop');
    }).not.toThrow();
    await expect(call).rejects.toThrow(LINKING_ERROR);

    // A native SDK from before markBootSuccess existed.
    const older = loadWith({ get: () => ({ getBundlePath: jest.fn() }) });
    await expect(older.markBootSuccess('shop')).rejects.toThrow(TypeError);
  });

  it('throws the linking error when TurboModuleRegistry is undefined', () => {
    // react-native-web and SSR have no TurboModuleRegistry.
    const api = loadWith(undefined);
    expect(() => api.getFileContent('shop', 'a.json')).toThrow(LINKING_ERROR);
  });
});
