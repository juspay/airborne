import { Command } from "commander";
import path from "path";
import { CreateApplicationAction, CreateDimensionAction, CreateFileAction, CreateOrganisationAction, CreatePackageAction, CreateReleaseAction, DeleteDimensionAction, GetReleaseAction, GetUserAction, ListDimensionsAction, ListFilesAction, ListOrganisationsAction, ListPackagesAction, ListReleasesAction, PostLoginAction, RequestOrganisationAction, ServeReleaseAction, ServeReleaseV2Action, UpdateDimensionAction, UploadFileAction } from "./action.js";
import { promises as fsPromises } from "fs";
import fs from "fs";
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import chalk from 'chalk';
import stringify from 'json-stringify-safe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const configFilePath = path.join(__dirname, ".config");

/**
 * Reads the config file and parses it as JSON.
 * Returns an Error if file not found.
 */
async function readConfigFile() {
  try {
    const data = await fsPromises.readFile(configFilePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `❌ No config file found. Please run configure --base-url <url>\` first.`
      );
    }
    throw err;
  }
}

/**
 * Reads the config file and parses it as JSON.
 * Returns an object (empty if file doesn't exist).
 */
async function readConfigFileOrEmpty() {
  try {
    const data = await fsPromises.readFile(configFilePath, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    if (err.code === "ENOENT") {
      return {};
    }
    throw err;
  }
}


/**
 * Writes the given config object to the config file as JSON.
 */
async function writeConfigFile(config) {
  try {
    await fsPromises.writeFile(configFilePath, JSON.stringify(config, null, 2), "utf-8");
  } catch (err) {
    throw err;
  }
}

/**
 * Get the endpoint from the config file
 */
export async function getBaseUrl() {
  try {
    const config = await readConfigFile();
    return config.baseUrl || null; // return null if not set
  } catch (err) {
    console.error("Error reading endpoint:", err);
    return null;
  }
}

/**
 * Set the endpoint in the config file
 */
export async function setBaseUrl(url) {
  try {
    const config = await readConfigFileOrEmpty();
    config.baseUrl = url;
    await writeConfigFile(config);
  } catch (err) {
    console.error("Error writing endpoint:", err);
  }
}


function readJsonFile(filePath) {
  if (path.extname(filePath).toLowerCase() !== ".json") {
    throw new Error("File must be a JSON file (.json)");
  }
  try {
    const data = fs.readFileSync(filePath, "utf8");
    return JSON.parse(data);
  } catch (err) {
    throw new Error(`Failed to read or parse JSON file: ${err.message}`);
  }
}

function printColoredJSON(obj, indent = 2) {
  const jsonString = stringify(obj, null, indent);
  
  // Apply colors while keeping valid JSON structure
  const colored = jsonString
    .replace(/"([^"]+)":/g, (match) => chalk.cyan(match))  // keys with quotes and colon
    .replace(/: "([^"]*)"/g, (match) => ': ' + chalk.green(match.slice(2)))  // string values
    .replace(/: (-?\d+\.?\d*)(,?)/g, (match, num, comma) => ': ' + chalk.yellow(num) + comma)  // numbers
    .replace(/: (true|false)/g, (match, bool) => ': ' + chalk.magenta(bool))  // booleans
    .replace(/: null/g, ': ' + chalk.gray('null'))  // null
    .replace(/\[Circular\]/g, chalk.red('[Circular]'));  // circular refs
  
  return colored;
}


const program = new Command()
  .name("airborne-core-cli")
  .description("Command-line interface for Airborne OTA operations")
  .version("0.18.2");

program
  .command("CreateApplication")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--application <application>", "application parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Create application request operation:

Usage 1 - Individual options:
  $ airborne-core-cli CreateApplication \\
     --application <application> \\
     --organisation <organisation> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli CreateApplication @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CreateApplication @params.json --application <value> --organisation <value> --token <value>

Parameters:
    --application <string> (required) : Name of the application
    --organisation <string> (required) : Name of the organisation
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli CreateApplication \\
     --application <application> \\
     --organisation <organisation> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli CreateApplication @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli CreateApplication @params.json --application <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "application": "example_application",
  "organisation": "example_organisation",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await CreateApplicationAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("CreateDimension")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--dimension <dimension>", "dimension parameter")
 .option("--description <description>", "description parameter")
 .option("--dimension_type <dimension_type>", "dimension_type parameter (allowed values: standard, cohort)", (value) => {
  const allowedValues = ["standard", "cohort"];
  if (!allowedValues.includes(value)) {
    throw new Error("--dimension_type must be one of: standard, cohort");
  }
  return value;
})
 .option("--depends_on <depends_on>", "depends_on parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Create dimension request operation:

Usage 1 - Individual options:
  $ airborne-core-cli CreateDimension \\
     --dimension <dimension> \\
     --description <description> \\
     --dimension_type <dimension_type> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--depends_on <depends_on>]

Usage 2 - JSON file:
  airborne-core-cli CreateDimension @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CreateDimension @params.json --dimension <value> --description <value> --token <value>

Parameters:
    --dimension <string> (required) : Name of the dimension
    --description <string> (required) : Description of the dimension
    --dimension_type <standard | cohort> (required) : Type of the dimension
    --depends_on <string> (optional) : Identifier of the dimension this depends on (required for cohort dimensions, ignored for standard dimensions)
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli CreateDimension \\
     --dimension <dimension> \\
     --description <description> \\
     --dimension_type <dimension_type> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--depends_on <depends_on>]

2. Using JSON file:
   $ airborne-core-cli CreateDimension @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli CreateDimension @params.json --dimension <value> --description <value> --token <value>

JSON file format (params.json):
{
  "dimension": "example_dimension",
  "description": "example_description",
  "dimension_type": "example_dimension_type",
  "depends_on": "example_depends_on",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await CreateDimensionAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("CreateFile")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--file_path <file_path>", "file_path parameter")
 .option("--url <url>", "url parameter")
 .option("--tag <tag>", "tag parameter")
 .option("--metadata <metadata>", "metadata parameter", (value) => {
  try {
    if (value.startsWith("@")) {
      return readJsonFile(value.slice(1));
    }
    return JSON.parse(value);
  } catch (err) {
    throw new Error("--metadata must be valid JSON or a @file.json path");
  }
})
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Create file request operation:

Usage 1 - Individual options:
  $ airborne-core-cli CreateFile \\
     --file_path <file_path> \\
     --url <url> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--tag <tag>]

Usage 2 - JSON file:
  airborne-core-cli CreateFile @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CreateFile @params.json --file_path <value> --url <value> --token <value>

Parameters:
    --file_path <string> (required) : Path where the file will be stored on sdk
    --url <string> (required) : URL from where the file can be downloaded
    --tag <string> (optional) : Tag to identify the file
    --metadata <document> (optional) : Metadata associated with the file in Stringified JSON format or a file attachment
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli CreateFile \\
     --file_path <file_path> \\
     --url <url> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--tag <tag>]

2. Using JSON file:
   $ airborne-core-cli CreateFile @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli CreateFile @params.json --file_path <value> --url <value> --token <value>

JSON file format (params.json):
{
  "file_path": "example_file_path",
  "url": "example_url",
  "tag": "example_tag",
  "metadata": {
    "example_key": "example_value",
    "version": "1.0.0"
  },
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await CreateFileAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("CreateOrganisation")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--name <name>", "name parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Create organisation request operation:

Usage 1 - Individual options:
  $ airborne-core-cli CreateOrganisation \\
     --name <name> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli CreateOrganisation @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CreateOrganisation @params.json --name <value> --token <value>

Parameters:
    --name <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli CreateOrganisation \\
     --name <name> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli CreateOrganisation @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli CreateOrganisation @params.json --name <value> --token <value>

JSON file format (params.json):
{
  "name": "example_name",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await CreateOrganisationAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("CreatePackage")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--index <index>", "index parameter")
 .option("--tag <tag>", "tag parameter")
 .option("--files <files...>", "files parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Create package request operation:

Usage 1 - Individual options:
  $ airborne-core-cli CreatePackage \\
     --index <index> \\
     --files <files> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--tag <tag>]

Usage 2 - JSON file:
  airborne-core-cli CreatePackage @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CreatePackage @params.json --index <value> --tag <value> --token <value>

Parameters:
    --index <string> (required) : Index file id
    --tag <string> (optional)
    --files [<string>] (required) : Space Separated file ids to be included in the package
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli CreatePackage \\
     --index <index> \\
     --files <files> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--tag <tag>]

2. Using JSON file:
   $ airborne-core-cli CreatePackage @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli CreatePackage @params.json --index <value> --tag <value> --token <value>

JSON file format (params.json):
{
  "index": "example_index",
  "tag": "example_tag",
  "files": "example_files",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await CreatePackageAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("CreateRelease")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--config <config>", "config parameter")
 .option("--package_id <package_id>", "package_id parameter")
 .option("--package <package>", "package parameter")
 .option("--dimensions <dimensions>", "dimensions parameter")
 .option("--resources <resources...>", "resources parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Create release request operation:

Usage 1 - Individual options:
  $ airborne-core-cli CreateRelease \\
     --config <config> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--package_id <package_id>]

Usage 2 - JSON file:
  airborne-core-cli CreateRelease @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CreateRelease @params.json --config <value> --package_id <value> --token <value>

Parameters:
    --config (required) : config for the release
        release_config_timeout <integer> (required) : Timeout for the release config in seconds
        boot_timeout <integer> (required) : Timeout for the package in seconds
        properties <document> (required) : Properties of the config in Stringified JSON format
    --package_id <string> (optional) : Package ID for the release
    --package (optional) : Package details for the release
        properties <document> (optional) : Properties of the package in Stringified JSON format or a file attachment
        important [<string>] (optional) : Important files in the package
        lazy [<string>] (optional) : Lazy files in the package
    --dimensions (optional) : Dimensions for the release in key-value format
        key <string> : Dimension name
        value <document> : Dimension value
    --resources [<string>] (optional) : Resources for the release
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli CreateRelease \\
     --config <config> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--package_id <package_id>]

2. Using JSON file:
   $ airborne-core-cli CreateRelease @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli CreateRelease @params.json --config <value> --package_id <value> --token <value>

JSON file format (params.json):
{
  "config": "example_config",
  "package_id": "example_package_id",
  "package": "example_package",
  "dimensions": "example_dimensions",
  "resources": "example_resources",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await CreateReleaseAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("DeleteDimension")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--dimension <dimension>", "dimension parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Delete dimension request operation:

Usage 1 - Individual options:
  $ airborne-core-cli DeleteDimension \\
     --dimension <dimension> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli DeleteDimension @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli DeleteDimension @params.json --dimension <value> --organisation <value> --token <value>

Parameters:
    --dimension <string> (required) : Name of the dimension
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli DeleteDimension \\
     --dimension <dimension> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli DeleteDimension @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli DeleteDimension @params.json --dimension <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "dimension": "example_dimension",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await DeleteDimensionAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("GetRelease")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--releaseId <releaseId>", "releaseId parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Release request operation:

Usage 1 - Individual options:
  $ airborne-core-cli GetRelease \\
     --releaseId <releaseId> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli GetRelease @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli GetRelease @params.json --releaseId <value> --organisation <value> --token <value>

Parameters:
    --releaseId <string> (required) : ID of the release
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli GetRelease \\
     --releaseId <releaseId> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli GetRelease @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli GetRelease @params.json --releaseId <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "releaseId": "example_releaseId",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await GetReleaseAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("GetUser")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')

 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Get user request operation:

Usage 1 - Individual options:
  $ airborne-core-cli GetUser \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli GetUser @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli GetUser @params.json --token <value>

Parameters:
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli GetUser \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli GetUser @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli GetUser @params.json --token <value>

JSON file format (params.json):
{
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await GetUserAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ListDimensions")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--page <page>", "page parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--page must be a valid integer");
  }
  return parsed;
})
 .option("--count <count>", "count parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--count must be a valid integer");
  }
  return parsed;
})
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List dimensions request operation:

Usage 1 - Individual options:
  $ airborne-core-cli ListDimensions \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--page <page>]

Usage 2 - JSON file:
  airborne-core-cli ListDimensions @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ListDimensions @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --page <integer> (optional)
    --count <integer> (optional)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ListDimensions \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--page <page>]

2. Using JSON file:
   $ airborne-core-cli ListDimensions @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ListDimensions @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "page": 123,
  "count": 123,
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await ListDimensionsAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ListFiles")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--page <page>", "page parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--page must be a valid integer");
  }
  return parsed;
})
 .option("--per_page <per_page>", "per_page parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--per_page must be a valid integer");
  }
  return parsed;
})
 .option("--search <search>", "search parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List files request operation:

Usage 1 - Individual options:
  $ airborne-core-cli ListFiles \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--page <page>]

Usage 2 - JSON file:
  airborne-core-cli ListFiles @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ListFiles @params.json --page <value> --per_page <value> --token <value>

Parameters:
    --page <integer> (optional) : Page number for pagination
    --per_page <integer> (optional) : Number of files per page
    --search <string> (optional) : Search query to filter files
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ListFiles \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--page <page>]

2. Using JSON file:
   $ airborne-core-cli ListFiles @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ListFiles @params.json --page <value> --per_page <value> --token <value>

JSON file format (params.json):
{
  "page": 123,
  "per_page": 123,
  "search": "example_search",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await ListFilesAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ListOrganisations")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')

 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List organisations request operation:

Usage 1 - Individual options:
  $ airborne-core-cli ListOrganisations \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli ListOrganisations @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ListOrganisations @params.json --token <value>

Parameters:
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ListOrganisations \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli ListOrganisations @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ListOrganisations @params.json --token <value>

JSON file format (params.json):
{
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await ListOrganisationsAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ListPackages")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--page <page>", "page parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--page must be a valid integer");
  }
  return parsed;
})
 .option("--count <count>", "count parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--count must be a valid integer");
  }
  return parsed;
})
 .option("--search <search>", "search parameter")
 .option("--all <all>", "all parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List packages request operation:

Usage 1 - Individual options:
  $ airborne-core-cli ListPackages \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--page <page>]

Usage 2 - JSON file:
  airborne-core-cli ListPackages @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ListPackages @params.json --page <value> --count <value> --token <value>

Parameters:
    --page <integer> (optional) : Offset for pagination (default: 1)
    --count <integer> (optional) : Limit for pagination (default: 50)
    --search <string> (optional) : Search term for filtering packages using index file path
    --all <boolean> (optional) : If true, fetch all packages without pagination
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ListPackages \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--page <page>]

2. Using JSON file:
   $ airborne-core-cli ListPackages @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ListPackages @params.json --page <value> --count <value> --token <value>

JSON file format (params.json):
{
  "page": 123,
  "count": 123,
  "search": "example_search",
  "all": "example_all",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await ListPackagesAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ListReleases")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--dimension <dimension>", "dimension parameter")
 .option("--page <page>", "page parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--page must be a valid integer");
  }
  return parsed;
})
 .option("--count <count>", "count parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--count must be a valid integer");
  }
  return parsed;
})
 .option("--all <all>", "all parameter")
 .option("--status <status>", "status parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List Releases request operation:

Usage 1 - Individual options:
  $ airborne-core-cli ListReleases \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--dimension <dimension>]

Usage 2 - JSON file:
  airborne-core-cli ListReleases @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ListReleases @params.json --dimension <value> --page <value> --token <value>

Parameters:
    --dimension <string> (optional) : dimension to filter releases in format key1=value1;key2=value2
    --page <integer> (optional) : Page number for pagination (default: 1)
    --count <integer> (optional) : Count of releases per page for pagination (default: 50)
    --all <boolean> (optional) : If true, fetch all releases without pagination
    --status <string> (optional) : Status to filter releases
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ListReleases \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--dimension <dimension>]

2. Using JSON file:
   $ airborne-core-cli ListReleases @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ListReleases @params.json --dimension <value> --page <value> --token <value>

JSON file format (params.json):
{
  "dimension": "example_dimension",
  "page": 123,
  "count": 123,
  "all": "example_all",
  "status": "example_status",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await ListReleasesAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("PostLogin")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--client_id <client_id>", "client_id parameter")
 .option("--client_secret <client_secret>", "client_secret parameter")
  .description(`
 Login request operation:

Usage 1 - Individual options:
  $ airborne-core-cli PostLogin \\
     --client_id <client_id> \\
     --client_secret <client_secret>

Usage 2 - JSON file:
  airborne-core-cli PostLogin @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli PostLogin @params.json --client_id <value> --client_secret <value>

Parameters:
    --client_id <string> (required) : Gmail of the user
    --client_secret <string> (required) : Password of the user

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli PostLogin \\
     --client_id <client_id> \\
     --client_secret <client_secret>

2. Using JSON file:
   $ airborne-core-cli PostLogin @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli PostLogin @params.json --client_id <value> --client_secret <value>

JSON file format (params.json):
{
  "client_id": "example_client_id",
  "client_secret": "example_client_secret"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await PostLoginAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("RequestOrganisation")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation_name <organisation_name>", "organisation_name parameter")
 .option("--name <name>", "name parameter")
 .option("--email <email>", "email parameter")
 .option("--phone <phone>", "phone parameter")
 .option("--app_store_link <app_store_link>", "app_store_link parameter")
 .option("--play_store_link <play_store_link>", "play_store_link parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Request organisation request operation:

Usage 1 - Individual options:
  $ airborne-core-cli RequestOrganisation \\
     --organisation_name <organisation_name> \\
     --name <name> \\
     --email <email> \\
     --phone <phone> \\
     --app_store_link <app_store_link> \\
     --play_store_link <play_store_link> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli RequestOrganisation @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli RequestOrganisation @params.json --organisation_name <value> --name <value> --token <value>

Parameters:
    --organisation_name <string> (required) : Name of the organisation
    --name <string> (required) : Name of the requester
    --email <string> (required) : Email of the requester
    --phone <string> (required) : Phone number of the requester
    --app_store_link <string> (required) : App store link
    --play_store_link <string> (required) : Play store link
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli RequestOrganisation \\
     --organisation_name <organisation_name> \\
     --name <name> \\
     --email <email> \\
     --phone <phone> \\
     --app_store_link <app_store_link> \\
     --play_store_link <play_store_link> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli RequestOrganisation @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli RequestOrganisation @params.json --organisation_name <value> --name <value> --token <value>

JSON file format (params.json):
{
  "organisation_name": "example_organisation_name",
  "name": "example_name",
  "email": "example_email",
  "phone": "example_phone",
  "app_store_link": "example_app_store_link",
  "play_store_link": "example_play_store_link",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await RequestOrganisationAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ServeRelease")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Get release request operation:

Usage 1 - Individual options:
  $ airborne-core-cli ServeRelease \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli ServeRelease @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ServeRelease @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ServeRelease \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli ServeRelease @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ServeRelease @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await ServeReleaseAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ServeReleaseV2")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Get release v2 request operation:

Usage 1 - Individual options:
  $ airborne-core-cli ServeReleaseV2 \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli ServeReleaseV2 @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ServeReleaseV2 @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ServeReleaseV2 \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli ServeReleaseV2 @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ServeReleaseV2 @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await ServeReleaseV2Action(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("UpdateDimension")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--dimension <dimension>", "dimension parameter")
 .option("--change_reason <change_reason>", "change_reason parameter")
 .option("--position <position>", "position parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--position must be a valid integer");
  }
  return parsed;
})
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Update dimension request operation:

Usage 1 - Individual options:
  $ airborne-core-cli UpdateDimension \\
     --dimension <dimension> \\
     --change_reason <change_reason> \\
     --position <position> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli UpdateDimension @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli UpdateDimension @params.json --dimension <value> --change_reason <value> --token <value>

Parameters:
    --dimension <string> (required) : Name of the dimension
    --change_reason <string> (required) : Reason for the change
    --position <integer> (required) : New position of the dimension
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli UpdateDimension \\
     --dimension <dimension> \\
     --change_reason <change_reason> \\
     --position <position> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli UpdateDimension @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli UpdateDimension @params.json --dimension <value> --change_reason <value> --token <value>

JSON file format (params.json):
{
  "dimension": "example_dimension",
  "change_reason": "example_change_reason",
  "position": 123,
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await UpdateDimensionAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("UploadFile")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--file <file>", "file parameter (file path, supports streaming)", (value) => {
  try {
    if (!fs.existsSync(value)) {
      throw new Error(`File not found: ${value}`);
    }
    return value; // Return path, will be processed later
  } catch (err) {
    throw new Error("--file must be a valid file path");
  }
})
 .option("--file_path <file_path>", "file_path parameter")
 .option("--tag <tag>", "tag parameter")
 .option("--checksum <checksum>", "checksum parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Upload file request operation:

Usage 1 - Individual options:
  $ airborne-core-cli UploadFile \\
     --file <file-path> \\
     --file_path <file_path> \\
     --checksum <checksum> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--tag <tag>]

Usage 2 - JSON file:
  airborne-core-cli UploadFile @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli UploadFile @params.json --file <file-path> --file_path <value> --token <value>

Parameters:
    --file <file-path> (streaming) (required) : File path of file to be uploaded
    --file_path <string> (required) : Path where the file will be stored on sdk
    --tag <string> (optional) : tag to identify the file
    --checksum <string> (required) : SHA-256 digest of the file, encoded in Base64, used by the server to verify the integrity of the uploaded file
    --organisation <string> (required)
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli UploadFile \\
     --file <file-path> \\
     --file_path <file_path> \\
     --checksum <checksum> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--tag <tag>]

2. Using JSON file:
   $ airborne-core-cli UploadFile @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli UploadFile @params.json --file <file-path> --file_path <value> --token <value>

JSON file format (params.json):
{
  "file": "./path/to/file.bin",
  "file_path": "example_file_path",
  "tag": "example_tag",
  "checksum": "example_checksum",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {
      
      const output = await UploadFileAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("configure")
  .requiredOption("-u, --base-url <url>", "Base endpoint URL for the API")
  .description(`
  Configure the CLI to use a specific API base URL.

  This command allows you to set or update the base API endpoint used by all subsequent CLI operations.
  It is typically the first command you should run before using any other commands.

  Usage:
    $ airborne-core-cli configure --base-url <api-url>

  Parameters:
      -u, --base-url <url> (required)
          The base URL of your API endpoint.
          Example: https://api.example.com or http://localhost:3000

  Examples:

  1. Setting the base URL for production:
    $ airborne-core-cli configure --base-url https://api.example.com

  2. Setting the base URL for local development:
    $ airborne-core-cli configure --base-url http://localhost:3000

  3. Overriding an existing configuration:
    $ airborne-core-cli configure -u https://staging.example.com

`)
  .usage('--base-url <url>')
  .action(async (options) => {
    try {
      await setBaseUrl(options.baseUrl);
      console.log(`✅ Base URL set to: ${options.baseUrl}`);
      process.exit(0);
    } catch (err) {
      console.error("❌ Failed to create config", err.message);
      process.exit(1);
    }
  });


export default program;