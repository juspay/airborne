#!/usr/bin/env node

const {
    program
} = require('commander');
const fs = require('fs');
const path = require('path');
const {
    execSync
} = require('child_process');
const readline = require('readline');

// Define CLI version and description
program
    .version('0.0.1')
    .argument('[platform]', 'Platform to build for (android/ios)')
    .description('Execute custom airborne build logic and output JSON')
    .option('-o, --output <file>', 'Output file for JSON result')
    .option('-v, --verbose', 'Enable verbose logging')
    .option('-t, --config_timeout <value>', 'Configuration timeout value (string)')
    .action(async (platform, options) => {
        await buildAirborne(platform, options);
    });

// Function to create interactive prompt
function createPromptInterface() {
    return readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
}

function promptUser(question) {
    return new Promise((resolve) => {
        const rl = createPromptInterface();
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

async function readAirborneConfig(options) {
    const configPath = path.join(process.cwd(), 'airborne-config.json');
    
    if (fs.existsSync(configPath)) {
        try {
            const configContent = fs.readFileSync(configPath, 'utf8');
            return await fillConfig(JSON.parse(configContent), options);
        } catch (error) {
            console.warn('⚠️  Could not parse airborne-config.json:', error.message);
        }
    }
    return await fillConfig({}, options);
}

async function fillConfig(airborneConfig, options) {
    return {
        "config_timeout": options?.config_timeout ?? airborneConfig?.config_timeout ?? await promptUser('\n⚙️  Configuration Setup Required\n Please enter the config_timeout value: '),
        "boot_timeout": options?.boot_timeout ?? airborneConfig?.boot_timeout ?? await promptUser('\n Please enter the boot_timeout value: '),
        "js_entry_file": options?.js_entry_file ?? airborneConfig?.js_entry_file ?? "index.js",
        "namespace": options?.namespace ?? airborneConfig?.namespace ?? await promptUser('\n Please enter namespace value [default]: '),
        "android": {
            "index_file_path": airborneConfig?.android?.index_file_path ?? "index.android.bundle"
        },
        "ios": {
            "index_file_path": airborneConfig?.ios?.index_file_path ?? "main.jsbundle"
        }
    }
}

// Function to read directory contents recursively
function readDirectoryRecursive(dirPath, baseDir = dirPath) {
    const items = [];

    if (!fs.existsSync(dirPath)) {
        return items;
    }

    const entries = fs.readdirSync(dirPath, {
        withFileTypes: true
    });

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        const relativePath = path.relative(baseDir, fullPath);

        if (entry.isDirectory()) {

            const result = readDirectoryRecursive(fullPath, baseDir);
            result.forEach(resultEntry => {
                items.push(resultEntry);
            });
        } else {
            items.push({
                name: entry.name,
                type: 'file',
                path: relativePath,
                fullPath: fullPath
            });
        }
    }

    return items;
}

async function executeReactNativeBundleCommand(command, options) {

    console.log('📦 Executing command: ', command);

    try {
        const remotebundleDir = path.join(process.cwd(), 'remotebundle');
        if (!fs.existsSync(remotebundleDir)) {
            fs.mkdirSync(remotebundleDir, {
                recursive: true
            });
        }

        // Execute the command
        const output = execSync(command, {
            encoding: 'utf8',
            cwd: process.cwd(),
            stdio: options.verbose ? 'inherit' : 'pipe'
        });

        return {
            success: true,
            output: output,
            command: command
        };

    } catch (error) {
        console.error('❌ React Native bundle command failed:', error.message);

        return {
            success: false,
            error: error.message,
            command: command,
            exitCode: error.status
        };
    }
}

async function buildAirborne(platform, options) {
    const platformArray = ["android", "ios"]

    if (!platformArray.includes(platform)) {
        console.log("❌ Enter proper platform command android or ios");
        process.exit(1);
    }

    const airborneConfig = await readAirborneConfig(options);
    console.log('🚀 Starting Airborne Build Process...');

    try {
        if (!airborneConfig.config_timeout) {
            console.log('❌ config_timeout is required. Exiting...');
            process.exit(1);
        }
        if (!airborneConfig.boot_timeout) {
            console.log('❌ boot_timeout is required. Exiting...');
            process.exit(1);
        }
        if (airborneConfig.namespace === undefined || airborneConfig.namespace === "default") {
            airborneConfig.namespace = "default"
        }

        const buildResult = await performAirborneBuildLogic(airborneConfig, platform);
        const jsonOutput = JSON.stringify(buildResult, null, 2);

        if (options.output) {
            fs.writeFileSync(options.output, jsonOutput);
            console.log(`✅ Build complete! Output saved to: ${options.output}`);
        } else {
            let defaultOutputPath = ""
            if (platform === "android") {
                defaultOutputPath = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'assets', airborneConfig.namespace, "release_config.json");
            } else {
                defaultOutputPath = path.join(process.cwd(), 'ios', `${airborneConfig.namespace}.bundle`, "release_config.json");
            }

            // Create directories if they don't exist
            const outputDir = path.dirname(defaultOutputPath);
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, {
                    recursive: true
                });
            }

            fs.writeFileSync(defaultOutputPath, jsonOutput);
            console.log('\n📄 Build Result:');
            console.log(jsonOutput);
        }
    } catch (error) {
        console.error('❌ Airborne build failed:', error.message);
        if (options.verbose) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

async function performAirborneBuildLogic(airborneConfig, platform) {

    const entry_file = airborneConfig.js_entry_file;
    const index_file_path = airborneConfig[platform].index_file_path;
    const build_folder = `${platform}/build/generated/airborne`

    const command = `npx react-native bundle --platform ${platform} --dev false --entry-file ${entry_file} --bundle-output ${build_folder}/${index_file_path} --assets-dest ${build_folder}`;
    const bundleResult = await executeReactNativeBundleCommand(command, platform);

    if (!bundleResult.success) {
        throw new Error(`React Native bundle command failed: ${bundleResult.error}`);
    }
    let indexFile = null;
    const importantFiles = [];

    const remotebundlePath = path.join(process.cwd(), build_folder);
    const remotebundleContents = readDirectoryRecursive(remotebundlePath);
    remotebundleContents.forEach(filePath => {
        if (filePath.name === index_file_path) {
            indexFile = {
                url: "dummy url",
                filePath: filePath.path
            };
        } else {
            importantFiles.push({
                url: "dummy url",
                filePath: filePath.path
            });
        }
    });

    return {
        version: "1",
        config: {
            version: "1.0.0",
            release_config_timeout: parseInt(airborneConfig.config_timeout),
            boot_timeout: parseInt(airborneConfig.boot_timeout),
            properties: {}
        },
        package: {
            name: airborneConfig.namespace,
            version: "2",
            properties: {},
            index: indexFile,
            important: importantFiles,
            lazy: []
        },
        resources: []
    };
}

// Parse command line arguments
program.parse(process.argv);

// If no arguments provided, run build-airborne directly
// if (!process.argv.slice(2).length) {
//     buildAirborne({});
// }