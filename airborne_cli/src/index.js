#!/usr/bin/env node

import { Command, InvalidOptionArgumentError } from "commander";
import coreCli from "airborne-core-cli";
import {
  readAirborneConfig,
  writeAirborneConfig,
  normalizeOptions,
  formatCommand,
  saveToken,
  airborneConfigExists,
  loadToken,
} from "./utils/common.js";
import { promptWithType } from "./utils/prompt.js";
import {
  createLocalReleaseConfig,
  readReleaseConfig,
  releaseConfigExists,
  updateLocalReleaseConfig,
} from "./utils/release.js";
import { createFiles, uploadFiles } from "./utils/file.js";
import { createPackageFromLocalRelease } from "./utils/package.js";
import { PostLoginAction } from "airborne-core-cli/action";
const program = new Command();

program
  .name("airborne-devkit")
  .description("Command-line interface for Airborne operations")
  .version("0.15.5");

coreCli.commands.forEach((cmd, i) => {
  if (cmd._name !== "PostLogin") {
    program.addCommand(formatCommand(cmd));
  }
});

program
  .command("create-local-airborne-config [directoryPath]")
  .description(
    `
  Create a local airborne config file for React Native projects:

  This command initializes the Airborne configuration in your React Native project directory.
  It creates the necessary configuration files to set up your project for OTA updates.

  Usage 1 - Interactive mode (recommended):
    $ airborne-devkit create-local-airborne-config

  Usage 2 - With all options specified:
    $ airborne-devkit create-local-airborne-config [directoryPath] \\
      -o <organisation> \\
      -n <namespace> \\
      -j <js-entry-file> \\
      -a <android-index-file> \\
      -i <ios-index-file>

  Parameters:
      [directoryPath] (optional) : Directory where config will be created (defaults to current directory)
      -o, --organisation <string> (optional) : Organisation name of the package
      -n, --namespace <string> (optional) : Namespace or application name of the package
      -j, --js-entry-file <string> (optional) : Path to the JavaScript entry file
      -a, --android-index-file <string> (optional) : Path to the Android bundle output file
      -i, --ios-index-file <string> (optional) : Path to the iOS bundle output file

`
  )
  .option("-o, --organisation <org>", "Organisation name of the package")
  .option(
    "-n, --namespace <namespace>",
    "Namespace or application name of the package"
  )
  .option("-j, --js-entry-file <path>", "Path to the JavaScript entry file")
  .option(
    "-a, --android-index-file <path>",
    "Path to the Android bundle output file"
  )
  .option("-i, --ios-index-file <path>", "Path to the iOS bundle output file")
  .addHelpText(
    "after",
    `
Examples:

1. Create config in current directory (interactive):
   $ airborne-devkit create-local-airborne-config

2. Create config in specific directory:
   $ airborne-devkit create-local-airborne-config /path/to/project

3. Create config with all options specified:
   $ airborne-devkit create-local-airborne-config \\
     -o "MyCompany" \\
     -n "MyApp" \\
     -j "index.js" \\
     -a "android/app/build/generated/assets/react/release/index.android.bundle" \\
     -i "ios/main.jsbundle"

4. Create config in specific directory with options:
   $ airborne-devkit create-local-airborne-config ./my-rn-project \\
     -o "MyCompany" \\
     -n "MyApp"

Notes:
- If directoryPath is not provided, current working directory will be used
- If organisation or namespace and others are not provided, you'll be prompted to enter them
- Command will fail if an airborne config already exists in the target directory`
  )
  .action(async (directoryPath, options) => {
    try {
      if (!directoryPath) {
        directoryPath = process.cwd();
      }
      options.directoryPath = directoryPath;
      const normalizedOptions = normalizeOptions(options);
      const existingAirborneConfig = await airborneConfigExists(
        normalizedOptions.directory_path
      );
      if (existingAirborneConfig) {
        console.error(`❌ Airborne config already exists.`);
        process.exit(1);
      }
      await writeAirborneConfig(normalizedOptions);
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to create local airborne config:", err.message);
      process.exit(1);
    }
  });

program
  .command("create-local-release-config [directoryPath]")
  .description(
    `
  Create a local release config file for a specific platform:

  This command creates platform-specific release configuration files that define
  how your React Native bundles should be packaged for OTA updates.

  Usage 1 - Interactive mode (recommended):
    $ airborne-devkit create-local-release-config

  Usage 2 - With platform specified:
    $ airborne-devkit create-local-release-config -p android

  Usage 3 - With all options:
    $ airborne-devkit create-local-release-config [directoryPath] \\
      -p <platform> \\
      -b <boot-timeout> \\
      -r <release-timeout>

  Parameters:
      [directoryPath] (optional) : Directory where config will be created (defaults to current directory)
      -p, --platform <string> (optional) : Target platform (android | ios)
      -b, --boot-timeout <number> (optional) : Boot timeout in milliseconds (positive number)
      -r, --release-timeout <number> (optional) : Release timeout in milliseconds (positive number)

`
  )
  .option(
    "-p, --platform <platform>",
    "Target platform: android | ios",
    (value) => {
      const lower = value.toLowerCase();
      if (!["android", "ios"].includes(lower)) {
        throw new InvalidOptionArgumentError(
          `Invalid platform: "${value}". Allowed values: android | ios`
        );
      }
      return lower;
    }
  )
  .option(
    "-b, --boot-timeout <timeout>",
    "Boot timeout in milliseconds (positive number)",
    (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num <= 0) {
        throw new InvalidOptionArgumentError(
          `Invalid boot timeout: "${value}". Must be a positive number.`
        );
      }
      return num;
    }
  )
  .option(
    "-r, --release-config-timeout <timeout>",
    "Release timeout in milliseconds (positive number)",
    (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num <= 0) {
        throw new InvalidOptionArgumentError(
          `Invalid release config timeout: "${value}". Must be a positive number.`
        );
      }
      return num;
    }
  )
  .addHelpText(
    "after",
    `
Examples:

1. Create release config interactively:
   $ airborne-devkit create-local-release-config

2. Create Android release config:
   $ airborne-devkit create-local-release-config -p android

3. Create iOS release config with timeouts:
   $ airborne-devkit create-local-release-config \\
     -p ios \\
     -b 30000 \\
     -r 60000

4. Create config in specific directory:
   $ airborne-devkit create-local-release-config ./my-project -p android

Notes:
- Requires an existing airborne config file in the directory
- Will prompt for platform if not specified via -p option
- Command will fail if a release config for the specified platform already exists in the directory
- Use 'update-local-release-config' to modify existing configurations`
  )
  .action(async (directoryPath, options) => {
    try {
      if (!directoryPath) {
        directoryPath = process.cwd();
      }
      options.directoryPath = directoryPath;
      if (!options.platform) {
        options.platform = await promptWithType(
          "\n Please enter the target platform (android/ios): ",
          ["android", "ios"]
        );
      }
      const normalizedOptions = normalizeOptions(options);
      const airborneConfig = await readAirborneConfig(
        normalizedOptions.directory_path
      );
      const releaseConfig = await releaseConfigExists(
        normalizedOptions.directory_path,
        normalizedOptions.platform,
        airborneConfig.namespace
      );
      if (releaseConfig) {
        console.error(
          `❌ Release config for ${normalizedOptions.platform} platform already exists in ${directoryPath}`
        );
        console.error(
          "Use 'update-local-release-config' command to modify existing configuration."
        );
        process.exit(1);
      }

      await createLocalReleaseConfig(
        airborneConfig,
        normalizedOptions,
        normalizedOptions.platform
      );

      process.exit(0); // Exit with success code
    } catch (err) {
      console.error("❌ Failed to create local release config:", err.message);
      process.exit(1); // Exit with failure code
    }
  });

program
  .command("update-local-release-config [directoryPath]")
  .description(
    `
  Update an existing local release config file:

  This command allows you to modify existing release configuration files
  for a specific platform, updating timeouts and other configuration settings.

  Usage 1 - Interactive mode:
    $ airborne-devkit update-local-release-config

  Usage 2 - Update specific platform:
    $ airborne-devkit update-local-release-config -p android

  Usage 3 - Update with new timeouts:
    $ airborne-devkit update-local-release-config \\
      -p ios \\
      -b 45000 \\
      -r 90000

  Parameters:
      [directoryPath] (optional) : Directory containing the config to update (defaults to current directory)
      -p, --platform <string> (optional) : Target platform (android | ios)
      -b, --boot-timeout <number> (optional) : New boot timeout in milliseconds (positive number)
      -r, --release-timeout <number> (optional) : New release timeout in milliseconds (positive number)
`
  )
  .option(
    "-p, --platform <platform>",
    "Target platform: android | ios",
    (value) => {
      const lower = value.toLowerCase();
      if (!["android", "ios"].includes(lower)) {
        throw new InvalidOptionArgumentError(
          `Invalid platform: "${value}". Allowed values: android | ios`
        );
      }
      return lower;
    }
  )
  .option(
    "-b, --boot-timeout <timeout>",
    "Boot timeout in milliseconds (positive number)",
    (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num <= 0) {
        throw new InvalidOptionArgumentError(
          `Invalid boot timeout: "${value}". Must be a positive number.`
        );
      }
      return num;
    }
  )
  .option(
    "-r, --release-timeout <timeout>",
    "Release timeout in milliseconds (positive number)",
    (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num <= 0) {
        throw new InvalidOptionArgumentError(
          `Invalid release config timeout: "${value}". Must be a positive number.`
        );
      }
      return num;
    }
  )
  .addHelpText(
    "after",
    `
Examples:

1. Update release config interactively:
   $ airborne-devkit update-local-release-config

2. Update Android config with new boot timeout:
   $ airborne-devkit update-local-release-config -p android -b 35000

3. Update iOS config with both timeouts:
   $ airborne-devkit update-local-release-config \\
     -p ios \\
     -b 40000 \\
     -r 80000

4. Update config in specific directory:
   $ airborne-devkit update-local-release-config ./my-project -p android

Notes:
- Requires existing airborne config and release config files
- Only specified timeout values will be updated; others remain unchanged
- Command will fail if the release config for the specified platform doesn't exist
- Use 'create-local-release-config' to create new configurations`
  )
  .action(async (directoryPath, options) => {
    try {
      if (!directoryPath) {
        directoryPath = process.cwd();
      }
      options.directoryPath = directoryPath;
      if (!options.platform) {
        options.platform = await promptWithType(
          "\n Please enter the target platform (android/ios): ",
          ["android", "ios"]
        );
      }
      const normalizedOptions = normalizeOptions(options);

      const config = await readAirborneConfig(normalizedOptions.directory_path);
      await updateLocalReleaseConfig(
        config,
        normalizedOptions,
        options.platform
      );

      process.exit(0); // Exit with success code
    } catch (err) {
      console.error("❌ Failed to create local release config:", err.message);
      process.exit(1); // Exit with failure code
    }
  });

program
  .command("create-remote-files [directoryPath]")
  .description(
    `
  Create remote file records for local files:

  This command processes your local React Native bundle files and either uploads them
  to the Airborne server or creates remote file records with external URLs.

  Usage 1 - Create remote file records with external URLs:
    $ airborne-devkit create-remote-files -p android

  Usage 2 - Upload files directly to Airborne server:
    $ airborne-devkit create-remote-files -p ios --upload

  Usage 3 - With custom tag:
    $ airborne-devkit create-remote-files \\
      -p android \\
      -t "v1.2.0" \\
      --upload

  Parameters:
      [directoryPath] (optional) : Directory containing the release config (defaults to current directory)
      -p, --platform <string> (required) : Target platform (android | ios)
      -t, --tag <string> (optional) : Tag to apply to the files for identification
      -u, --upload (optional) : Upload files directly to Airborne server instead of using external URLs

`
  )
  .option(
    "-p, --platform <platform>",
    "Target platform: android | ios",
    (value) => {
      const lower = value.toLowerCase();
      if (!["android", "ios"].includes(lower)) {
        throw new InvalidOptionArgumentError(
          `Invalid platform: "${value}". Allowed values: android | ios`
        );
      }
      return lower;
    }
  )
  .option("-t, --tag <tag>", "Tag to apply to the files", (tag) => {
    if (tag === "__default__") {
      throw new Error("You cannot use '__default__' as a tag.");
    }
    return tag;
  })
  .option("-u, --upload", "Upload files to the Airborne server")
  .addHelpText(
    "after",
    `
Examples:

1. Create remote file records for Android (will prompt for base URL):
   $ airborne-devkit create-remote-files -p android

2. Upload iOS files directly to Airborne server:
   $ airborne-devkit create-remote-files -p ios --upload

3. Create remote files with custom tag:
   $ airborne-devkit create-remote-files -p android -t "release-1.0.0"

4. Process files in specific directory:
   $ airborne-devkit create-remote-files ./my-project -p android --upload

5. Upload files with tag:
   $ airborne-devkit create-remote-files -p ios --upload -t "beta-2.1.0"

Workflow:
- Without --upload: Creates file records pointing to external URLs (you'll be prompted for base URL)
- With --upload: Directly uploads files to Airborne server storage
- Files processed include both important files and index files from release config
- Requires authentication token (use 'login' command first)

Notes:
- Requires existing airborne config, release config, and authentication
- Will prompt for platform if not specified
- Files are taken from the release config's important and index file lists
- Tags help organize and identify file versions
- External URL mode requires you to host files on your own CDN/server`
  )
  .action(async (directoryPath, options) => {
    try {
      if (!directoryPath) {
        directoryPath = process.cwd();
      }
      options.directoryPath = directoryPath;
      if (!options.platform) {
        options.platform = await promptWithType(
          "\n Please enter the target platform (android/ios): ",
          ["android", "ios"]
        );
      }
      const normalizedOptions = normalizeOptions(options);
      let airborneConfig = await readAirborneConfig(
        normalizedOptions.directory_path
      );

      airborneConfig = { ...airborneConfig, ...normalizedOptions };
      const releaseConfig = await readReleaseConfig(
        airborneConfig.directory_path,
        airborneConfig.platform,
        airborneConfig.namespace
      );
      const filesToUpload = releaseConfig.package.important.concat(
        releaseConfig.package.index
      );
      try {
        airborneConfig.token = await loadToken(normalizedOptions.directory_path)
          .access_token;
      } catch (err) {
        throw new Error("Please log in first");
      }
      if (!options.upload) {
        let baseUrl = await promptWithType(
          "\n Provide your base url for files: ",
          "string"
        );
        if (baseUrl[baseUrl.length - 1] !== "/") {
          baseUrl = baseUrl + "/";
        }
        await createFiles(filesToUpload, airborneConfig, baseUrl);
      } else {
        await uploadFiles(filesToUpload, airborneConfig);
      }
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to create remote files:", err.message);
      process.exit(1);
    }
  });

program
  .command("create-remote-package [directoryPath]")
  .description(
    `
  Create a remote package from local release configuration:

  This command creates a deployable package on the Airborne server using your
  local release configuration and uploaded files. The package can then be
  used for OTA deployments to your React Native applications.

  Usage 1 - Interactive mode:
    $ airborne-devkit create-remote-package

  Usage 2 - With platform specified:
    $ airborne-devkit create-remote-package -p android

  Usage 3 - With custom tag:
    $ airborne-devkit create-remote-package \\
      -p ios \\
      -t "production-v1.2.0"

  Parameters:
      [directoryPath] (optional) : Directory containing the release config (defaults to current directory)
      -p, --platform <string> (required) : Target platform (android | ios)
      -t, --tag <string> (optional) : Tag to apply to the package for identification and versioning

`
  )
  .option(
    "-p, --platform <platform>",
    "Target platform: android | ios",
    (value) => {
      const lower = value.toLowerCase();
      if (!["android", "ios"].includes(lower)) {
        throw new InvalidOptionArgumentError(
          `Invalid platform: "${value}". Allowed values: android | ios`
        );
      }
      return lower;
    }
  )
  .option("-t, --tag <tag>", "Tag to apply to the files", (tag) => {
    if (tag === "__default__") {
      throw new Error("You cannot use '__default__' as a tag.");
    }
    return tag;
  })
  .addHelpText(
    "after",
    `
Examples:

1. Create package interactively:
   $ airborne-devkit create-remote-package

2. Create Android package:
   $ airborne-devkit create-remote-package -p android

3. Create iOS package with version tag:
   $ airborne-devkit create-remote-package -p ios -t "v2.1.0"

4. Create package from specific directory:
   $ airborne-devkit create-remote-package ./my-rn-project -p android

5. Create production package with descriptive tag:
   $ airborne-devkit create-remote-package \\
     -p android \\
     -t "production-release-2024-01-15"

Package Creation Process:
1. Reads local airborne and release configurations
2. Validates authentication and permissions
3. Creates package record on Airborne server
4. Associates uploaded files with the package
5. Makes package available for release

Prerequisites:
- Must have completed 'create-remote-files' step first
- Requires valid authentication token (use 'login' command)
- Local airborne and release configs must exist
- Files referenced in release config must be uploaded

Notes:
- Will prompt for platform if not provided
- Tags help identify and manage different package versions
- Package becomes immediately available for release after creation
- Each platform requires a separate package creation`
  )
  .action(async (directoryPath, options) => {
    try {
      if (!directoryPath) {
        directoryPath = process.cwd();
      }
      options.directoryPath = directoryPath;
      if (!options.platform) {
        options.platform = await promptWithType(
          "\n Please enter the target platform (android/ios): ",
          ["android", "ios"]
        );
      }
      const normalizedOptions = normalizeOptions(options);
      let airborneConfig = await readAirborneConfig(
        normalizedOptions.directory_path
      );

      airborneConfig = { ...airborneConfig, ...normalizedOptions };
      airborneConfig.token = await loadToken(normalizedOptions.directory_path)
        .access_token;
      const releaseConfig = await readReleaseConfig(
        airborneConfig.directory_path,
        airborneConfig.platform,
        airborneConfig.namespace
      );

      await createPackageFromLocalRelease(airborneConfig, releaseConfig);
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to create remote package: ", err.message);
      process.exit(1);
    }
  });

program
  .command("login [directoryPath]")
  .description(
    `
  Login to the Airborne server and store authentication credentials:

  This command authenticates you with the Airborne server using your client credentials
  and stores the authentication tokens locally for use with subsequent commands.

  Usage:
    $ airborne-devkit login \\
      --client_id <your-client-id> \\
      --client_secret <your-client-secret>

  Parameters:
      [directoryPath] (optional) : Directory where auth tokens will be stored (defaults to current directory)
      --client_id <string> (required) : Client ID provided by Airborne for authentication
      --client_secret <string> (required) : Client Secret provided by Airborne for authentication

`
  )
  .requiredOption("--client_id <clientId>", "Client ID for authentication")
  .requiredOption(
    "--client_secret <clientSecret>",
    "Client Secret for authentication"
  )
  .addHelpText(
    "after",
    `
Examples:

1. Login in current directory:
   $ airborne-devkit login \\
     --client_id "your_client_id_here" \\
     --client_secret "your_client_secret_here"

2. Login and store tokens in specific directory:
   $ airborne-devkit login ./my-project \\
     --client_id "your_client_id_here" \\
     --client_secret "your_client_secret_here"

3. Using environment variables:
   $ airborne-devkit login \\
     --client_id "$AIRBORNE_CLIENT_ID" \\
     --client_secret "$AIRBORNE_CLIENT_SECRET"

Authentication Flow:
1. Sends credentials to Airborne authentication endpoint
2. Receives access token and refresh token on success
3. Stores tokens locally in the specified directory
4. Tokens are automatically used by other commands

Security Notes:
- Tokens are stored locally and should be kept secure
- Do not share your client credentials or commit them to version control
- Use environment variables or secure credential storage in CI/CD

Troubleshooting:
- Ensure your client credentials are valid and active
- Check network connectivity to Airborne servers
- Verify you have write permissions in the target directory`
  )
  .action(async (directoryPath, options) => {
    try {
      if (!directoryPath) {
        directoryPath = process.cwd();
      }

      const loginOptions = {
        client_id: options.client_id,
        client_secret: options.client_secret,
      };

      const result = await PostLoginAction(null, loginOptions);
      console.log("✅ Login successful");
      saveToken(
        result.user_token.access_token,
        result.user_token.refresh_token,
        directoryPath
      );
      process.exit(0);
    } catch (err) {
      console.error("❌ Login error:", err.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);
