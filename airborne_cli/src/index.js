#!/usr/bin/env node

import { Command, InvalidOptionArgumentError } from "commander";
import coreCli from "airborne-core-cli";
import {
  readAndResolveAirborneConfig,
  writeAirborneConfig,
  normalizeOptions,
  formatCommand,
  saveToken,
  airborneConfigExists,
  requireToken,
} from "./utils/common.js";
import {
  parseBaseUrl,
  projectConfigPath,
  useProjectEndpoint,
  writeProjectConfig,
} from "./utils/project-config.js";
import { explainAuthFailure } from "./utils/auth.js";
import { bundleRelease, publishRelease, registerReleaseFiles } from "./utils/publish.js";
import { promptWithType } from "./utils/prompt.js";
import { PLATFORMS, parsePlatform } from "./utils/platform.js";
import {
  createLocalReleaseConfig,
  readReleaseConfig,
  releaseConfigExists,
  updateLocalReleaseConfig,
  writeReleaseConfig,
} from "./utils/release.js";
import { createPackageFromLocalRelease } from "./utils/package.js";
import {
  ConcludeReleaseAction,
  DiscardReleaseAction,
  GetReleaseAction,
  PostLoginAction,
  RampReleaseAction,
  RollbackReleaseAction,
} from "airborne-core-cli/action";
import {
  MAX_RAMP_PERCENTAGE,
  describeFailure,
  parseRampPercentage,
  runLifecycle,
} from "./utils/lifecycle.js";
const program = new Command();

// Servers are chosen per project (.airborne/config.json), not by a file inside this checkout.
try { useProjectEndpoint(process.cwd()); } catch (err) { console.error(err.message); }

program
  .name("airborne-devkit")
  .description("Command-line interface for Airborne operations")
  .version("0.49.1");

program.command("first-release")
  .description("Create the app_version dimension and prepare an exact-version release; no rollout")
  .requiredOption("--endpoint <url>")
  .requiredOption("--organisation <name>")
  .requiredOption("--application <name>")
  .requiredOption("--package-version <number>")
  .requiredOption("--app-version <version>")
  .action(async options => {
    try {
      const { firstRelease } = await import("./init/first-release.js");
      const token = process.env.AIRBORNE_TOKEN || requireToken(process.cwd());
      console.log(JSON.stringify(await firstRelease({ ...options, token }), null, 2));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  });

program.command("init [directory]")
  .description("Integrate a recognized bare React Native Kotlin/Swift scaffold")
  .requiredOption("--organisation <name>")
  .requiredOption("--application <name>")
  .requiredOption("--endpoint <url>")
  .option("--ios-application <name>", "Distinct iOS application (defaults to application-ios)")
  .option("--ios-sdk-project <path>", "Local native iOS SDK pod for testing unpublished checkout changes")
  .option("--android-sdk-project <path>", "Local native Android SDK module for testing unpublished checkout changes")
  .option("--sdk <version>", "SDK version or local package path", "^0.45.0")
  .option("--dry-run", "Print unified diff without writing files")
  .action(async (directory = process.cwd(), options) => {
    try {
      const { initProject } = await import("./init/project.js");
      console.log(initProject(directory, options));
    } catch (error) { console.error(error.message); process.exitCode = 1; }
  });

coreCli.commands.forEach((cmd, i) => {
  // PostLogin has its own login command; configure is per project below, not a file in this checkout.
  if (cmd._name !== "PostLogin" && cmd._name !== "configure") {
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
      --android-organisation <android-organisation> \\
      --ios-organisation <ios-organisation> \\
      --android-namespace <android-namespace> \\
      --ios-namespace <ios-namespace> \\
      -j <js-entry-file> \\
      -a <android-index-file> \\
      -i <ios-index-file> \\
      -e \\
      --hermes-enabled

  Parameters:
      [directoryPath] (optional) : Directory where config will be created (defaults to current directory)
      --android-organisation <string> (optional) : Organisation name for Android
      --ios-organisation <string> (optional) : Organisation name for iOS
      --android-namespace <string> (optional) : Namespace or application name for Android
      --ios-namespace <string> (optional) : Namespace or application name for iOS
      -j, --js-entry-file <string> (optional) : Path to the JavaScript entry file
      -a, --android-index-file <string> (optional) : Path to the Android bundle output file
      -i, --ios-index-file <string> (optional) : Path to the iOS bundle output file
      -e, --expo (optional) : Indicates if the project is using Expo
      --hermes-enabled (optional) : Enable Hermes engine for the project

`
  )
  .option(
    "--android-organisation <org>",
    "Organisation name for Android"
  )
  .option(
    "--ios-organisation <org>",
    "Organisation name for iOS"
  )
  .option(
    "--android-namespace <namespace>",
    "Namespace or application name for Android"
  )
  .option(
    "--ios-namespace <namespace>",
    "Namespace or application name for iOS"
  )
  .option("-j, --js-entry-file <path>", "Path to the JavaScript entry file")
  .option(
    "-a, --android-index-file <path>",
    "Path to the Android bundle output file"
  )
  .option("-i, --ios-index-file <path>", "Path to the iOS bundle output file")
  .option("-e, --expo", "Indicates if the project is using Expo")
  .option("--hermes-enabled", "Enable Hermes engine for the project")
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
     --android-organisation "MyCompany" \\
     --ios-organisation "MyCompany" \\
     --android-namespace "MyApp" \\
     --ios-namespace "MyApp" \\
     -j "index.js" \\
     -a "android/app/build/generated/assets/react/release/index.android.bundle" \\
     -i "ios/main.jsbundle"

4. Create config in specific directory with options:
   $ airborne-devkit create-local-airborne-config ./my-rn-project \\
     --android-organisation "MyCompany" \\
     --ios-organisation "MyCompany" \\
     --android-namespace "MyApp" \\
     --ios-namespace "MyApp"

5. Create config for an Expo project:
   $ airborne-devkit create-local-airborne-config -e

6. Create config with Hermes enabled:
   $ airborne-devkit create-local-airborne-config --hermes-enabled

7. Create config for Expo project with all options:
   $ airborne-devkit create-local-airborne-config \\
     --android-organisation "MyCompany" \\
     --ios-organisation "MyCompany" \\
     --android-namespace "MyApp" \\
     --ios-namespace "MyApp" \\
     -e

Notes:
- If directoryPath is not provided, current working directory will be used
- If organisations, namespaces, and others are not provided, you'll be prompted to enter them
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
      -r <release-config-timeout>

  Parameters:
      [directoryPath] (optional) : Directory where config will be created (defaults to current directory)
      -p, --platform <string> (optional) : Target platform (android | ios | web)
      -b, --boot-timeout <number> (optional) : Boot timeout in milliseconds (positive number)
      -r, --release-config-timeout <number> (optional) : Release config timeout in milliseconds (positive number)

`
  )
  .option(
    "-p, --platform <platform>",
    "Target platform: android | ios | web",
    parsePlatform
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
    "--release-timeout <timeout>",
    "Deprecated alias for --release-config-timeout",
    (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num <= 0) {
        throw new InvalidOptionArgumentError(
          `Invalid release config timeout: "${value}". Must be a positive number.`
        );
      }
      console.warn(
        "Warning: --release-timeout is deprecated; use --release-config-timeout instead."
      );
      return num;
    }
  )
  .option(
    "-r, --release-config-timeout <timeout>",
    "Release config timeout in milliseconds (positive number)",
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
          "\n Please enter the target platform (android/ios/web): ",
          PLATFORMS
        );
      }
      const normalizedOptions = normalizeOptions(options);
      const airborneConfig = await readAndResolveAirborneConfig(
        normalizedOptions.directory_path,
        normalizedOptions.platform
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
          "To bundle the JavaScript again and refresh this config, run 'airborne-devkit bundle -p " + normalizedOptions.platform + "'. To change its timeouts, use 'update-local-release-config'."
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
      -p, --platform <string> (optional) : Target platform (android | ios | web)
      -b, --boot-timeout <number> (optional) : New boot timeout in milliseconds (positive number)
      -r, --release-config-timeout <number> (optional) : New release config timeout in milliseconds (positive number)
`
  )
  .option(
    "-p, --platform <platform>",
    "Target platform: android | ios | web",
    parsePlatform
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
    "--release-timeout <timeout>",
    "Deprecated alias for --release-config-timeout",
    (value) => {
      const num = parseInt(value, 10);
      if (isNaN(num) || num <= 0) {
        throw new InvalidOptionArgumentError(
          `Invalid release config timeout: "${value}". Must be a positive number.`
        );
      }
      console.warn(
        "Warning: --release-timeout is deprecated; use --release-config-timeout instead."
      );
      return num;
    }
  )
  .option(
    "-r, --release-config-timeout <timeout>",
    "Release config timeout in milliseconds (positive number)",
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
          "\n Please enter the target platform (android/ios/web): ",
          PLATFORMS
        );
      }
      const normalizedOptions = normalizeOptions(options);

      const config = await readAndResolveAirborneConfig(
        normalizedOptions.directory_path,
        options.platform
      );
      await updateLocalReleaseConfig(
        config,
        normalizedOptions,
        options.platform
      );

      process.exit(0); // Exit with success code
    } catch (err) {
      console.error("❌ Failed to update local release config:", err.message);
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
      -p, --platform <string> (required) : Target platform (android | ios | web)
      -t, --tag <string> (optional) : Tag to apply to the files for identification
      -u, --upload (optional) : Upload files directly to Airborne server instead of using external URLs

`
  )
  .option(
    "-p, --platform <platform>",
    "Target platform: android | ios | web",
    parsePlatform
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
          "\n Please enter the target platform (android/ios/web): ",
          PLATFORMS
        );
      }
      const normalizedOptions = normalizeOptions(options);
      useProjectEndpoint(normalizedOptions.directory_path);
      let airborneConfig = await readAndResolveAirborneConfig(
        normalizedOptions.directory_path,
        normalizedOptions.platform
      );

      airborneConfig = { ...airborneConfig, ...normalizedOptions };
      const releaseConfig = await readReleaseConfig(
        airborneConfig.directory_path,
        airborneConfig.platform,
        airborneConfig.namespace
      );

      airborneConfig.token = requireToken(normalizedOptions.directory_path);

      let baseUrl;
      if (!options.upload) {
        baseUrl = await promptWithType(
          "\n Provide your base url for files: ",
          "string"
        );
        if (baseUrl[baseUrl.length - 1] !== "/") {
          baseUrl = baseUrl + "/";
        }
      }

      await registerReleaseFiles(airborneConfig, releaseConfig, {
        upload: options.upload,
        baseUrl,
      });

      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to create remote files:", explainAuthFailure(err));
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
      -p, --platform <string> (required) : Target platform (android | ios | web)
      -t, --tag <string> (optional) : Tag to apply to the package for identification and versioning

`
  )
  .option(
    "-p, --platform <platform>",
    "Target platform: android | ios | web",
    parsePlatform
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
          "\n Please enter the target platform (android/ios/web): ",
          PLATFORMS
        );
      }
      const normalizedOptions = normalizeOptions(options);
      useProjectEndpoint(normalizedOptions.directory_path);
      let airborneConfig = await readAndResolveAirborneConfig(
        normalizedOptions.directory_path,
        normalizedOptions.platform
      );

      airborneConfig = { ...airborneConfig, ...normalizedOptions };
      airborneConfig.token = requireToken(normalizedOptions.directory_path);
      const releaseConfig = await readReleaseConfig(
        airborneConfig.directory_path,
        airborneConfig.platform,
        airborneConfig.namespace
      );

      await createPackageFromLocalRelease(airborneConfig, releaseConfig);
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to create remote package: ", explainAuthFailure(err));
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

      useProjectEndpoint(directoryPath);
      const result = await PostLoginAction(null, loginOptions);
      await saveToken(result.access_token, result.refresh_token, directoryPath, result.expires_in);
      const minutes = Math.floor(Number(result.expires_in) / 60);
      console.log(
        `✅ Login successful for ${process.env.AIRBORNE_BASE_URL || "https://airborne.juspay.in"}.` +
          (minutes > 0 ? ` The access token is valid for about ${minutes} minute${minutes === 1 ? "" : "s"}; log in again after that.` : "")
      );
      process.exit(0);
    } catch (err) {
      console.error("❌ Login error:", err.message);
      process.exit(1);
    }
  });

program
  .command("configure [directoryPath]")
  .description(
    `
  Choose the Airborne server for this project:

  The URL is saved in <project>/.airborne/config.json, so each project can use its own server and nothing
  is written into the CLI checkout. Without it the CLI talks to https://airborne.juspay.in.
  The AIRBORNE_BASE_URL environment variable overrides it for one command.

  Parameters:
      [directoryPath] (optional) : Project directory (defaults to current directory)
      -u, --base-url <url> (required) : Origin of the Airborne API, for example http://localhost:8080
`
  )
  .requiredOption("-u, --base-url <url>", "Origin of the Airborne API")
  .addHelpText(
    "after",
    `
Examples:

1. Use a local sandbox for this project:
   $ airborne-devkit configure --base-url http://localhost:8080
`
  )
  .action((directoryPath, options) => {
    try {
      const directory = directoryPath || process.cwd();
      const file = writeProjectConfig(directory, { baseUrl: parseBaseUrl(options.baseUrl) });
      console.log(`✅ Base URL for this project set to ${parseBaseUrl(options.baseUrl)} (${file}).`);
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to configure:", err.message);
      process.exit(1);
    }
  });

program
  .command("bundle [directoryPath]")
  .description(
    `
  Bundle the JavaScript and refresh the platform's release_config.json:

  Runs the React Native bundler (and the Hermes compiler when airborne-config.json enables it) into
  <platform>/build/generated/airborne, then lists the output in release_config.json. It creates the release
  config when there is none and rewrites it when there is (keeping its timeouts), so it is safe to run after
  'init' and again after every change. Run it before create-remote-files.

  Parameters:
      [directoryPath] (optional) : Project directory (defaults to current directory)
      -p, --platform <string> (required) : android | ios | web
`
  )
  .requiredOption("-p, --platform <platform>", "android | ios | web", platformOption)
  .action(async (directoryPath, options) => {
    try {
      await bundleRelease(directoryPath || process.cwd(), options.platform);
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to bundle:", err.message);
      process.exit(1);
    }
  });

program
  .command("publish [directoryPath]")
  .description(
    `
  Ship the current JavaScript as an OTA update in one command:

  bundle -> upload -> create package -> prepare an exact-version release -> ramp (then conclude only with --conclude).
  The package version is whatever the server assigns, and the app version is read from the project
  (android/app/build.gradle versionName, or the iOS MARKETING_VERSION), so there are no numbers to guess.
  Needs 'configure' and a fresh 'login' for this platform's application; the release applies only to
  installs whose app_version matches.

  Parameters:
      [directoryPath] (optional) : Project directory (defaults to current directory)
      -p, --platform <string> (required) : android | ios | web
      --app-version <version> : Binary version to target (default: read from the project)
      --ramp <0-${MAX_RAMP_PERCENTAGE}> : Traffic percentage to ramp to before concluding (default ${MAX_RAMP_PERCENTAGE})
      --conclude : Conclude immediately after the ramp (default: stop after ramp)
      --prepare-only : Stop with the release at 0% traffic; ramp it yourself with ramp-release
      -t, --tag <string> : Tag for the uploaded files and package
`
  )
  .requiredOption("-p, --platform <platform>", "android | ios | web", platformOption)
  .option("--app-version <version>", "Binary version to target (default: read from the project)")
  .option("--ramp <percentage>", `Traffic percentage before concluding, 0 to ${MAX_RAMP_PERCENTAGE}`, (value) => {
    try {
      return parseRampPercentage(value);
    } catch (err) {
      throw new InvalidOptionArgumentError(err.message);
    }
  })
  .option("--conclude", "Conclude immediately after the ramp", false)
  .option("--prepare-only", "Stop with the release at zero traffic")
  .option("-t, --tag <tag>", "Tag for the uploaded files and package", (tag) => {
    if (tag === "__default__") {
      throw new InvalidOptionArgumentError("You cannot use '__default__' as a tag.");
    }
    return tag;
  })
  .addHelpText(
    "after",
    `
Examples:

1. Publish and ramp to 50% on the installed app version:
   $ airborne-devkit publish -p android

2. Prepare the release but leave it at 0% for review:
   $ airborne-devkit publish -p android --prepare-only

The release id is printed; use it with ramp-release, conclude-release, discard-release or rollback-release.
Exits with a nonzero status, naming the stage, when any step fails.`
  )
  .action(async (directoryPath, options) => {
    try {
      const directory = directoryPath || process.cwd();
      useProjectEndpoint(directory);
      const result = await publishRelease({
        directory,
        platform: options.platform,
        tag: options.tag,
        appVersion: options.appVersion,
        ramp: options.ramp,
        conclude: options.conclude,
        prepareOnly: options.prepareOnly,
      });
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    } catch (err) {
      console.error(`❌ ${explainAuthFailure(err)}`);
      process.exit(1);
    }
  });

// Release lifecycle: ramp, conclude, discard and roll back a release by id.
const lifecycleActions = {
  ConcludeReleaseAction,
  DiscardReleaseAction,
  GetReleaseAction,
  RampReleaseAction,
  RollbackReleaseAction,
};

function platformOption(value) {
  const lower = value.toLowerCase();
  if (!["android", "ios", "web"].includes(lower)) {
    throw new InvalidOptionArgumentError(
      `Invalid platform: "${value}". Allowed values: android | ios | web`
    );
  }
  return lower;
}

// Organisation and application come from --organisation/--application, or from the
// airborne-config.json section of --platform, like the other release commands.
async function lifecycleScope(directoryPath, options) {
  const directory = directoryPath || process.cwd();
  useProjectEndpoint(directory);
  const token = requireToken(directory);
  let { organisation, application } = options;
  if (!organisation || !application) {
    if (!options.platform) {
      throw new Error(
        "Pass --platform, or both --organisation and --application"
      );
    }
    const config = await readAndResolveAirborneConfig(
      directory,
      options.platform
    );
    organisation = organisation || config.organisation;
    application = application || config.namespace;
  }
  return { organisation, application, token };
}

function addLifecycleCommand(kind, name, description, configure, examples) {
  const command = program
    .command(`${name} <releaseId> [directoryPath]`)
    .description(description)
    .option("-p, --platform <platform>", "android | ios | web", platformOption)
    .option("--organisation <organisation>", "Organisation (skips airborne-config.json)")
    .option("--application <application>", "Application (skips airborne-config.json)");
  configure(command);
  command
    .addHelpText("after", `\nExamples:\n${examples}\n\nExits with a nonzero status when the server refuses the request.`)
    .action(async (releaseId, directoryPath, options) => {
      try {
        const scope = await lifecycleScope(directoryPath, options);
        const result = await runLifecycle(
          kind,
          { ...options, ...scope, releaseId },
          lifecycleActions
        );
        const { $metadata, ...body } = result;
        console.log(JSON.stringify(body, null, 2));
        process.exit(0);
      } catch (err) {
        console.error(`❌ Failed to ${name.replace("-release", "")} release:`, explainAuthFailure(describeFailure(err)));
        process.exit(1);
      }
    });
}

addLifecycleCommand(
  "ramp",
  "ramp-release",
  `
  Set the share of traffic that receives a release:

  A new release serves no traffic until it is ramped. Ramping a created release
  starts it; ramp again to raise or lower the share, or set 0 to pause it. The
  most a release can be ramped to is ${MAX_RAMP_PERCENTAGE}; conclude the release to send everyone to it.
  When the application requires approvals, raising the share is refused with
  "approval_required"; raise a deployment request instead.

  Parameters:
      <releaseId> (required) : Id of the release
      [directoryPath] (optional) : Directory with airborne-config.json and login (defaults to current directory)
      --percentage <0-${MAX_RAMP_PERCENTAGE}> (required) : Traffic percentage
      --reason <string> (optional) : Reason recorded upstream
`,
  (command) =>
    command
      .requiredOption("--percentage <percentage>", `Traffic percentage, 0 to ${MAX_RAMP_PERCENTAGE}`, (value) => {
        try {
          return parseRampPercentage(value);
        } catch (err) {
          throw new InvalidOptionArgumentError(err.message);
        }
      })
      .option("-r, --reason <reason>", "Reason recorded upstream"),
  `1. Start a release at 10%:
   $ airborne-devkit ramp-release 7522252134449025024 -p android --percentage 10

2. Pause it:
   $ airborne-devkit ramp-release 7522252134449025024 -p android --percentage 0`
);

addLifecycleCommand(
  "conclude",
  "conclude-release",
  `
  Make one outcome of a ramped release permanent:

  "--variant release" promotes the release to everyone; "--variant control" ends it
  and keeps the previous release live. The release must be ramped first. When the
  application requires approvals, every conclude is refused with "approval_required".

  Parameters:
      <releaseId> (required) : Id of the release
      [directoryPath] (optional) : Directory with airborne-config.json and login (defaults to current directory)
      --variant <release|control|id> (required) : Outcome, or an exact variant id
      --reason <string> (optional) : Reason recorded upstream
`,
  (command) =>
    command
      .requiredOption("--variant <variant>", "release | control | exact variant id")
      .option("-r, --reason <reason>", "Reason recorded upstream"),
  `1. Promote a release:
   $ airborne-devkit conclude-release 7522252134449025024 -p android --variant release

2. End it and keep the previous release:
   $ airborne-devkit conclude-release 7522252134449025024 -p android --variant control`
);

addLifecycleCommand(
  "discard",
  "discard-release",
  `
  Discard a release that has not been ramped:

  Only a created release can be discarded. A ramped release must be concluded on
  control or rolled back instead. Discarding never needs approval.

  Parameters:
      <releaseId> (required) : Id of the release
      [directoryPath] (optional) : Directory with airborne-config.json and login (defaults to current directory)
      --reason <string> (optional) : Reason recorded upstream
`,
  (command) => command.option("-r, --reason <reason>", "Reason recorded upstream"),
  `1. Discard a release:
   $ airborne-devkit discard-release 7522252134449025024 -p android`
);

addLifecycleCommand(
  "rollback",
  "rollback-release",
  `
  Roll a release back according to its state:

  A created release is discarded, a ramped release is concluded on control, and a
  live release is replaced by a re-release of the previous live one. Check the
  result first with the GetControlCenterRollbackPreview command.

  Parameters:
      <releaseId> (required) : Id of the release
      [directoryPath] (optional) : Directory with airborne-config.json and login (defaults to current directory)
      --reason <string> (required) : Why the release is rolled back
      --emergency (optional) : Use the constrained emergency path (current checkers only)
      --confirm-sensitive-risk (optional) : Required when the release is marked rollback-sensitive
`,
  (command) =>
    command
      .requiredOption("-r, --reason <reason>", "Why the release is rolled back")
      .option("--emergency", "Use the emergency rollback path")
      .option("--confirm-sensitive-risk", "Confirm a rollback-sensitive release"),
  `1. Roll back a live release:
   $ airborne-devkit rollback-release 7522252134449025024 -p android --reason "crash on launch"`
);

// Parse command line arguments
program.parse(process.argv);
