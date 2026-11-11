import { readFileMapping } from "./file.js";
import { CreatePackageAction } from "airborne-core-cli/action";
import { writeReleaseConfig } from "./release.js";
import { explainAuthFailure } from "./auth.js";
import fs from "fs";
import path from "path";

// create-remote-package only reads what create-remote-files recorded, so name the step and tag that are missing.
export function missingUploadMessage(file_path, config) {
  const { directory_path, organisation, namespace, tag, platform } = config;
  const where = `organisation ${organisation}, application ${namespace}, tag ${tag ? `"${tag}"` : "(none)"}`;
  let others = [];
  try {
    const mappings = JSON.parse(
      fs.readFileSync(path.join(directory_path, ".airborne", "mappings.json"), "utf8")
    );
    others = Object.entries(mappings[organisation]?.[namespace] || {})
      .filter(([name, files]) => files[file_path] && name !== (tag || "__default__"))
      .map(([name]) => (name === "__default__" ? null : name));
  } catch {
    // No mappings yet: nothing was uploaded from this project.
  }
  const flags = `-p ${platform || "<platform>"} --upload${tag ? ` -t ${tag}` : ""}`;
  return (
    `No uploaded record of "${file_path}" for ${where}. ` +
    `Run create-remote-files ${flags} first (create-remote-package only uses what that step recorded in .airborne/mappings.json), ` +
    `and fix any error it printed. Use the same -t tag for both steps.` +
    (others.length
      ? ` This file is recorded under ${others.map((t) => (t ? `tag "${t}"` : "no tag")).join(", ")}; pass ${others[0] ? `-t ${others[0]}` : "no -t"} if that is the upload you meant.`
      : "")
  );
}

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
      airborneConfig
    );
    if (!indexMapping) {
      throw new Error(missingUploadMessage(indexFilePath, airborneConfig));
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
        airborneConfig
      );
      if (!mapping) {
        throw new Error(missingUploadMessage(file_path, airborneConfig));
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

    let packg;
    try {
      packg = await CreatePackageAction(null, createPackageOptions);
    } catch (err) {
      throw new Error(explainAuthFailure(err));
    }
    releaseConfig.package.version = packg.version.toString();
    await writeReleaseConfig(
      releaseConfig,
      airborneConfig.platform,
      airborneConfig.namespace,
      airborneConfig.directory_path
    );
  } catch (err) {
    console.error("Error creating package from local release:", err.message);
    throw err;
  }
}
