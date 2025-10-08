import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { hexToBase64, sha256FileHex } from "./common.js";
import { UploadFileAction, CreateFileAction } from "airborne-core-cli/action";

export function readDirectoryRecursive(dirPath, baseDir = dirPath) {
  const items = [];

  if (!fs.existsSync(dirPath)) {
    return items;
  }

  const entries = fs.readdirSync(dirPath, {
    withFileTypes: true,
  });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    const relativePath = path.relative(baseDir, fullPath);

    if (entry.isDirectory()) {
      const result = readDirectoryRecursive(fullPath, baseDir);
      result.forEach((resultEntry) => {
        items.push(resultEntry);
      });
    } else {
      items.push({
        name: entry.name,
        type: "file",
        path: relativePath,
        fullPath: fullPath,
      });
    }
  }

  return items;
}

export async function executeReactNativeBundleCommand(command) {
  console.log("📦 Executing command: ", command);

  try {
    const remotebundleDir = path.join(process.cwd(), "remotebundle");
    if (!fs.existsSync(remotebundleDir)) {
      fs.mkdirSync(remotebundleDir, {
        recursive: true,
      });
    }

    // Execute the command
    const output = execSync(command, {
      encoding: "utf8",
      cwd: process.cwd(),
    });

    return {
      success: true,
      output: output,
      command: command,
    };
  } catch (error) {
    console.error("❌ React Native bundle command failed:", error.message);

    return {
      success: false,
      error: error.message,
      command: command,
      exitCode: error.status,
    };
  }
}
export const uploadFiles = async (filesToUpload, config) => {
  console.log(
    `🚀 Starting upload process for ${filesToUpload.length} files...`
  );

  const results = {
    uploaded: 0,
    existing: 0,
    failed: 0,
    errors: [],
  };

  try {
    for (let index = 0; index < filesToUpload.length; index++) {
      const fileObj = filesToUpload[index];
      const fileProgress = `[${index + 1}/${filesToUpload.length}]`;

      try {
        console.log(`${fileProgress} 🔍 Processing ${fileObj.file_path}...`);

        const storedChecksum = await getMappedChecksum(
          config.directory_path,
          fileObj.file_path,
          config.tag
        );

        const baseDir = path.isAbsolute(config.directory_path)
          ? config.directory_path
          : path.join(process.cwd(), config.directory_path);

        const fileFullPath = path.join(
          baseDir,
          config.platform,
          "build",
          "generated",
          "airborne",
          fileObj.file_path
        );

        if (!fs.existsSync(fileFullPath)) {
          throw new Error(`File not found: ${fileFullPath}`);
        }

        const checksum = await sha256FileHex(fileFullPath);

        if (storedChecksum === checksum) {
          console.log(
            `${fileProgress} ✅ File already exists, checksum matches`
          );
          results.existing++;
          continue;
        }

        console.log(`${fileProgress} ⬆️ Uploading file: ${fileObj.file_path}`);

        const uploadOptions = {
          file: fileFullPath,
          file_path: fileObj.file_path,
          organisation: config.organisation,
          application: config.namespace,
          token: config.token,
          checksum: hexToBase64(checksum),
          tag: config.tag,
        };

        const uploadOutput = await UploadFileAction(null, uploadOptions);

        if (!uploadOutput.file_path || !uploadOutput.id) {
          throw new Error("Upload failed, invalid response from server");
        }

        await createFileMapping(
          config.directory_path,
          uploadOutput.file_path,
          uploadOutput.id,
          uploadOutput.checksum,
          uploadOutput.tag
        );

        // Check if this was a new upload or existing file returned
        if (uploadOutput.checksum === checksum) {
          console.log(
            `${fileProgress} ✅ Successfully processed ${fileObj.file_path}`
          );
          results.uploaded++;
        } else {
          console.log(`${fileProgress} 🔄 File already existed on server`);
          results.existing++;
        }
      } catch (err) {
        console.error(
          `${fileProgress} 🚨 Error processing ${fileObj.file_path}:`,
          err.message
        );

        results.failed++;
        results.errors.push({ file: fileObj.file_path, error: err.message });
      }
    }

    console.log("\n📊 Upload Summary:");
    console.log(`✅ Uploaded: ${results.uploaded}`);
    console.log(`♻️ Existing: ${results.existing}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log("\n📋 Failed files:");
      results.errors.forEach(({ file, error }) => {
        console.log(`  • ${file}: ${error}`);
      });
    }
  } catch (err) {
    console.error("\n💥 Upload process failed:", err.message);
    throw err;
  }
};

export async function createFiles(filesToCreate, config, prefixUrl) {
  console.log(
    `🚀 Starting file creation process for ${filesToCreate.length} files...`
  );

  const results = {
    created: 0,
    existing: 0,
    failed: 0,
    errors: [],
  };

  try {
    for (let index = 0; index < filesToCreate.length; index++) {
      const fileObj = filesToCreate[index];
      const fileProgress = `[${index + 1}/${filesToCreate.length}]`;

      try {
        console.log(`${fileProgress} 🔍 Processing ${fileObj.file_path}...`);

        const storedChecksum = await getMappedChecksum(
          config.directory_path,
          fileObj.file_path,
          config.tag
        );

        const baseDir = path.isAbsolute(config.directory_path)
          ? config.directory_path
          : path.join(process.cwd(), config.directory_path);

        const fileFullPath = path.join(
          baseDir,
          config.platform,
          "build",
          "generated",
          "airborne",
          fileObj.file_path
        );

        if (!fs.existsSync(fileFullPath)) {
          throw new Error(`File not found: ${fileFullPath}`);
        }

        if (storedChecksum) {
          console.log(`${fileProgress} 🔐 Calculating checksum...`);
          const checksum = await sha256FileHex(fileFullPath);

          if (storedChecksum === checksum) {
            console.log(
              `${fileProgress} ✅ File already exists, checksum matches`
            );
            results.existing++;
            continue;
          }
        }

        console.log(
          `${fileProgress} 🆕 Creating file record for ${fileObj.file_path}...`
        );

        const fileUrl = prefixUrl + fileObj.file_path;
        console.log(`${fileProgress} 🔗 File URL: ${fileUrl}`);

        const createOptions = {
          file_path: fileObj.file_path,
          url: fileUrl,
          organisation: config.organisation,
          application: config.namespace,
          token: config.token,
          tag: config.tag,
        };

        const output = await CreateFileAction(null, createOptions);

        if (!output.file_path || !output.id) {
          throw new Error(
            "CreateFileAction failed, invalid response from server"
          );
        }

        await createFileMapping(
          config.directory_path,
          output.file_path,
          output.id,
          output.checksum,
          output.tag
        );

        console.log(
          `${fileProgress} ✅ Successfully processed file record for ${fileObj.file_path}`
        );
        results.created++;
      } catch (err) {
        console.error(
          `${fileProgress} 🚨 Error processing ${fileObj.file_path}:`,
          err.message
        );
        results.failed++;
        results.errors.push({ file: fileObj.file_path, error: err.message });
      }
    }

    console.log("\n📊 File Creation Summary:");
    console.log(`🆕 Created: ${results.created}`);
    console.log(`♻️ Existing: ${results.existing}`);
    console.log(`❌ Failed: ${results.failed}`);

    if (results.errors.length > 0) {
      console.log("\n📋 Failed files:");
      results.errors.forEach(({ file, error }) => {
        console.log(`  • ${file}: ${error}`);
      });
    }
  } catch (err) {
    console.error("\n💥 File creation process failed:", err.message);
    throw err;
  }
}

export async function createFileMapping(
  directory_path,
  file_path,
  id,
  checksum,
  tag
) {
  const airborneDir = path.join(directory_path, ".airborne");
  const mappingFile = path.join(airborneDir, "mappings.json");

  try {
    // Read existing mappings if file exists
    let mappings = {};
    try {
      const data = await fs.promises.readFile(mappingFile, "utf8");
      mappings = JSON.parse(data);
    } catch (err) {
      if (err.code !== "ENOENT") throw err; // ignore file not found
    }
    if (!tag) {
      tag = "__default__";
    }

    if (!mappings[tag]) {
      mappings[tag] = {};
    }

    // Update or insert mapping with checksum
    mappings[tag][file_path] = { id, checksum };

    // Write updated mappings back
    await fs.promises.writeFile(
      mappingFile,
      JSON.stringify(mappings, null, 2),
      "utf8"
    );
  } catch (error) {
    console.error("❌ Failed to update file mapping:", error.message);
    throw error;
  }
}

export async function getMappedChecksum(directory_path, file_path, tag) {
  const mappingFile = path.join(directory_path, ".airborne", "mappings.json");
  if (!tag) {
    tag = "__default__";
  }

  try {
    const data = await fs.promises.readFile(mappingFile, "utf8");
    const mappings = JSON.parse(data);
    return mappings[tag][file_path]?.checksum || null;
  } catch (err) {
    return null;
  }
}

export async function readFileMapping(directory_path, file_path, tag) {
  const mappingFile = path.join(directory_path, ".airborne", "mappings.json");

  if (!tag) {
    tag = "__default__";
  }

  try {
    const data = await fs.promises.readFile(mappingFile, "utf8");
    const mappings = JSON.parse(data);
    return mappings[tag][file_path] || null;
  } catch (err) {
    return null;
  }
}
