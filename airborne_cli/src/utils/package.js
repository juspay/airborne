import { readFileMapping } from "./file.js";
import { CreatePackageAction } from "airborne-core-cli/action";
import { writeReleaseConfig } from "./release.js";

export async function createPackageFromLocalRelease(
  airborneConfig,
  releaseConfig
) {
  try {
    const pkg = releaseConfig.package;

    if (!pkg.index?.file_path) {
      throw new Error("Index file missing in package.");
    }

    const indexFilePath = pkg.index.file_path;
    const indexMapping = await readFileMapping(
      airborneConfig.directory_path,
      indexFilePath,
      airborneConfig.tag
    );
    if (!indexMapping) {
      throw new Error(`Missing upload for index file: ${indexFilePath}`);
    }
    const index_id = indexMapping.id;

    const files = [];
    if (Array.isArray(pkg.important)) files.push(...pkg.important);
    if (Array.isArray(pkg.lazy)) files.push(...pkg.lazy);
    if (Array.isArray(releaseConfig.resources)) {
      files.push(...releaseConfig.resources);
    }

    const file_ids = [];
    for (const { file_path, _ } of files) {
      const mapping = await readFileMapping(
        airborneConfig.directory_path,
        file_path,
        airborneConfig.tag
      );
      if (!mapping) {
        throw new Error(`Missing mapping for file: ${file_path}`);
      }
      file_ids.push(mapping.id);
    }

    // Prepare package creation options
    const createPackageOptions = {
      index: index_id,
      organisation: airborneConfig.organisation,
      application: airborneConfig.namespace,
      token: airborneConfig.token,
      tag: airborneConfig.tag,
      files: file_ids,
    };

    const packg = await CreatePackageAction(null, createPackageOptions);
    releaseConfig.package.version = packg.version.toString();
    await writeReleaseConfig(
      releaseConfig,
      airborneConfig.platform,
      airborneConfig.namespace,
      airborneConfig.directory_path
    );
  } catch (err) {
    console.error("Error creating package from local release:", err.message);
  }
}
