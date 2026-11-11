import { bootAirborne, markBootSuccess, requireRuntime } from './web/loader';

export { bootAirborne, markBootSuccess };
export type {
  AirborneBootEvent,
  AirborneWebOptions,
  BootResult,
  ReleaseConfig,
} from './web/types';

export async function readReleaseConfig(nameSpace: string): Promise<string> {
  return JSON.stringify(requireRuntime(nameSpace).releaseConfig);
}

/** The runtime's URL for `filePath`, once files cached before boot are in place. */
async function fileUrl(
  nameSpace: string,
  filePath: string
): Promise<string | undefined> {
  const runtime = requireRuntime(nameSpace);
  await runtime.ready;
  return Object.prototype.hasOwnProperty.call(runtime.files, filePath)
    ? runtime.files[filePath]
    : undefined;
}

export async function getFileContent(
  nameSpace: string,
  filePath: string
): Promise<string> {
  const url = await fileUrl(nameSpace, filePath);
  if (!url) {
    throw new Error(`Airborne: ${filePath} is not available`);
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Airborne: ${filePath} -> ${response.status}`);
  }
  return response.text();
}

export async function getBundlePath(nameSpace: string): Promise<string> {
  return requireRuntime(nameSpace).bundlePath;
}

/** Web only: a URL usable in `<img src>` or `Image` for a downloaded file. */
export async function getFileUrl(
  nameSpace: string,
  filePath: string
): Promise<string | null> {
  return (await fileUrl(nameSpace, filePath)) ?? null;
}

const Airborne = {
  markBootSuccess,
  readReleaseConfig,
  getFileContent,
  getBundlePath,
  getFileUrl,
};

export default Airborne;
