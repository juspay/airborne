import { Command } from "commander";
import path from "path";
import { AcknowledgeEmergencyRollbackAction, ApproveControlCenterDeploymentRequestAction, CancelControlCenterDeploymentRequestAction, ConcludeReleaseAction, CreateApplicationAction, CreateCohortRangeAction, CreateControlCenterDeploymentRequestAction, CreateControlCenterGroupAction, CreateDimensionAction, CreateFileAction, CreateOrganisationAction, CreatePackageAction, CreateReleaseAction, DeleteControlCenterGroupAction, DeleteDimensionAction, DiscardReleaseAction, GetControlCenterApprovalPolicyAction, GetControlCenterDeploymentRequestAction, GetControlCenterOverviewAction, GetControlCenterReleaseEventsAction, GetControlCenterRollbackPreviewAction, GetReleaseAction, GetServingPolicyAction, GetTelemetrySummaryAction, GetUserAction, IngestTelemetryReportsAction, ListControlCenterDeploymentRequestsAction, ListControlCenterGroupsAction, ListControlCenterOperationsAction, ListDimensionsAction, ListFileGroupsAction, ListFilesAction, ListOrganisationsAction, ListPackagesAction, ListReleasesAction, PostLoginAction, PreviewServingPolicyAction, PutServingPolicyAction, RampReleaseAction, RejectControlCenterDeploymentRequestAction, RequestOrganisationAction, ResolveControlCenterOperationAction, RollbackReleaseAction, ServeReleaseAction, ServeReleaseV2Action, UpdateControlCenterApprovalPolicyAction, UpdateControlCenterGroupAction, UpdateDimensionAction, UpdateFileAction, UploadFileAction } from "./action.js";
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
    const config = JSON.parse(await fsPromises.readFile(configFilePath, "utf-8"));
    return config.baseUrl || "https://airborne.juspay.in";
  } catch (err) {
    if (err.code === "ENOENT") return "https://airborne.juspay.in";
    throw err;
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
  .version("0.49.1");

program
  .command("AcknowledgeEmergencyRollback")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--release_id <release_id>", "release_id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--reason <reason>", "reason parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Independently acknowledge the emergency rollback for its source release. Only a different current checker may acknowledge it.:

Usage 1 - Individual options:
  $ airborne-core-cli AcknowledgeEmergencyRollback \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --reason <reason> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli AcknowledgeEmergencyRollback @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli AcknowledgeEmergencyRollback @params.json --release_id <value> --organisation <value> --token <value>

Parameters:
    --release_id <string> (required)
    --organisation <string> (required)
    --application <string> (required)
    --reason <string> (required) : Independent review explanation; must be nonblank.
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli AcknowledgeEmergencyRollback \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --reason <reason> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli AcknowledgeEmergencyRollback @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli AcknowledgeEmergencyRollback @params.json --release_id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "release_id": "example_release_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "reason": "example_reason",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await AcknowledgeEmergencyRollbackAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ApproveControlCenterDeploymentRequest")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--id <id>", "id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--reason <reason>", "reason parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Approve and immediately execute a pending request. The checker must be currently eligible and different from the immutable requester.:

Usage 1 - Individual options:
  $ airborne-core-cli ApproveControlCenterDeploymentRequest \\
     --id <id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--reason <reason>]

Usage 2 - JSON file:
  airborne-core-cli ApproveControlCenterDeploymentRequest @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ApproveControlCenterDeploymentRequest @params.json --id <value> --organisation <value> --token <value>

Parameters:
    --id <string> (required)
    --organisation <string> (required)
    --application <string> (required)
    --reason <string> (optional)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ApproveControlCenterDeploymentRequest \\
     --id <id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--reason <reason>]

2. Using JSON file:
   $ airborne-core-cli ApproveControlCenterDeploymentRequest @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ApproveControlCenterDeploymentRequest @params.json --id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "id": "example_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "reason": "example_reason",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await ApproveControlCenterDeploymentRequestAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("CancelControlCenterDeploymentRequest")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--id <id>", "id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--reason <reason>", "reason parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Cancel a request. Only its requester may cancel it.:

Usage 1 - Individual options:
  $ airborne-core-cli CancelControlCenterDeploymentRequest \\
     --id <id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--reason <reason>]

Usage 2 - JSON file:
  airborne-core-cli CancelControlCenterDeploymentRequest @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CancelControlCenterDeploymentRequest @params.json --id <value> --organisation <value> --token <value>

Parameters:
    --id <string> (required)
    --organisation <string> (required)
    --application <string> (required)
    --reason <string> (optional)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli CancelControlCenterDeploymentRequest \\
     --id <id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--reason <reason>]

2. Using JSON file:
   $ airborne-core-cli CancelControlCenterDeploymentRequest @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli CancelControlCenterDeploymentRequest @params.json --id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "id": "example_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "reason": "example_reason",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await CancelControlCenterDeploymentRequestAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ConcludeRelease")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--release_id <release_id>", "release_id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--chosen_variant <chosen_variant>", "chosen_variant parameter")
 .option("--change_reason <change_reason>", "change_reason parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Make one variant of a ramped release permanent. Concluding on an experimental variant promotes the release; concluding on the control variant ends it and leaves the previous release live. Read the variant ids from experiment.experiment_variants on GetRelease. The release must have been ramped first. Unknown release ids return 404. Pass the organisation and application in the x-organisation and x-application headers. Returns 409 when the release is still only created (ramp it first) or has already concluded or been discarded, 409 with "code: unresolved" when an upstream outcome is unknown, and 400 when the chosen variant does not exist. When the application requires approvals, every conclude is refused with 403 "approval_required"; raise a deployment request instead. Requires a bearer token and release conclude permission.:

Usage 1 - Individual options:
  $ airborne-core-cli ConcludeRelease \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --chosen_variant <chosen_variant> \\
     --token <string> \\
     [--change_reason <change_reason>]

Usage 2 - JSON file:
  airborne-core-cli ConcludeRelease @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ConcludeRelease @params.json --release_id <value> --organisation <value> --token <value>

Parameters:
    --release_id <string> (required) : ID of the release (the experiment id returned by CreateRelease).
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --chosen_variant <string> (required) : Variant to make permanent: the control variant keeps the previous release live, an experimental variant promotes this release. Take the id from experiment.experiment_variants on GetRelease; the experiment service generates the ids, so they cannot be guessed. An unknown variant returns 400 and names the available ones.
    --change_reason <string> (optional) : Optional reason recorded upstream. It must not contain the reserved, case-sensitive text "Airborne operation", and with the generated suffix it must fit Superposition's 255-byte limit, so it is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ConcludeRelease \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --chosen_variant <chosen_variant> \\
     --token <string> \\
     [--change_reason <change_reason>]

2. Using JSON file:
   $ airborne-core-cli ConcludeRelease @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ConcludeRelease @params.json --release_id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "release_id": "example_release_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "chosen_variant": "example_chosen_variant",
  "change_reason": "example_change_reason",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await ConcludeReleaseAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("CreateApplication")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--application <application>", "application parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Create a new application inside an organisation. Pass the target organisation in the x-organisation header. Returns the created application and the caller's access levels. Requires a bearer token.:

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
  .command("CreateCohortRange")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--dimension <dimension>", "dimension parameter")
 .option("--name <name>", "name parameter")
 .option("--lower <lower>", "lower parameter")
 .option("--upper <upper>", "upper parameter")
 .option("--priority <priority>", "priority parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--priority must be a valid integer");
  }
  return parsed;
})
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Add an independent inclusive stable major.minor.patch semantic version interval. Prerelease and build metadata bounds return 400 because upstream comparators do not support their precedence. Earlier definitions are unchanged. Enum index zero wins overlaps. Does not alter checkpoint semantics. Requires cohort update permission; unavailable while maker-checker is enabled, like other targeting edits.:

Usage 1 - Individual options:
  $ airborne-core-cli CreateCohortRange \\
     --organisation <organisation> \\
     --application <application> \\
     --dimension <dimension> \\
     --name <name> \\
     --lower <lower> \\
     --upper <upper> \\
     --priority <priority> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli CreateCohortRange @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CreateCohortRange @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --dimension <string> (required)
    --name <string> (required)
    --lower <string> (required)
    --upper <string> (required)
    --priority <integer> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli CreateCohortRange \\
     --organisation <organisation> \\
     --application <application> \\
     --dimension <dimension> \\
     --name <name> \\
     --lower <lower> \\
     --upper <upper> \\
     --priority <priority> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli CreateCohortRange @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli CreateCohortRange @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "dimension": "example_dimension",
  "name": "example_name",
  "lower": "example_lower",
  "upper": "example_upper",
  "priority": 123,
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await CreateCohortRangeAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("CreateControlCenterDeploymentRequest")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--action <action>", "action parameter (allowed values: create, update, ramp, conclude, discard, rollback, set_strict_serving, set_rollback_sensitive)", (value) => {
  const allowedValues = ["create", "update", "ramp", "conclude", "discard", "rollback", "set_strict_serving", "set_rollback_sensitive"];
  if (!allowedValues.includes(value)) {
    throw new Error("--action must be one of: create, update, ramp, conclude, discard, rollback, set_strict_serving, set_rollback_sensitive");
  }
  return value;
})
 .option("--payload <payload>", "payload parameter")
 .option("--reason <reason>", "reason parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Raise an immutable deployment request. The server resolves and freezes the snapshot, hashes it and records the authenticated subject as requester.:

Usage 1 - Individual options:
  $ airborne-core-cli CreateControlCenterDeploymentRequest \\
     --organisation <organisation> \\
     --application <application> \\
     --action <action> \\
     --payload <payload> \\
     --reason <reason> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli CreateControlCenterDeploymentRequest @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CreateControlCenterDeploymentRequest @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --action <create | update | ramp | conclude | discard | rollback | set_strict_serving | set_rollback_sensitive> (required)
    --payload (required)
        body <document> (optional)
        release_id <string> (optional)
    --reason <string> (required) : Nonblank maker explanation. Reserved "Airborne operation" text is refused.
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli CreateControlCenterDeploymentRequest \\
     --organisation <organisation> \\
     --application <application> \\
     --action <action> \\
     --payload <payload> \\
     --reason <reason> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli CreateControlCenterDeploymentRequest @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli CreateControlCenterDeploymentRequest @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "action": "example_action",
  "payload": "example_payload",
  "reason": "example_reason",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await CreateControlCenterDeploymentRequestAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("CreateControlCenterGroup")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--name <name>", "name parameter")
 .option("--members <members...>", "members parameter", [])
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Create a group with a name and full member list. Requires Bearer authentication and an x-organisation header. Only organisation admins/owners can create groups.:

Usage 1 - Individual options:
  $ airborne-core-cli CreateControlCenterGroup \\
     --organisation <organisation> \\
     --name <name> \\
     --members <members> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli CreateControlCenterGroup @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CreateControlCenterGroup @params.json --organisation <value> --name <value> --token <value>

Parameters:
    --organisation <string> (required)
    --name <string> (required)
    --members (required)
        undefined (optional)
            application <string> (required)
            platform <android | ios | web | other> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli CreateControlCenterGroup \\
     --organisation <organisation> \\
     --name <name> \\
     --members <members> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli CreateControlCenterGroup @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli CreateControlCenterGroup @params.json --organisation <value> --name <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "name": "example_name",
  "members": "example_members",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await CreateControlCenterGroupAction(paramsFile, options);
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
 Create a targeting dimension (standard or cohort) that releases can be targeted against. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.:

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
 Register a file by URL, recording its metadata and assigning it a version. Pass the organisation and application in the x-organisation and x-application headers. Use this when the file is already hosted somewhere the server can reach; to upload the bytes directly, use UploadFile instead. Requires a bearer token.:

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
 Create a new organisation owned by the authenticated user. Returns the created organisation with its (initially empty) application list and the caller's access levels. Requires a bearer token.:

Usage 1 - Individual options:
  $ airborne-core-cli CreateOrganisation \\
     --name <name> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli CreateOrganisation @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli CreateOrganisation @params.json --name <value> --token <value>

Parameters:
    --name <string> (required) : Name for the new organisation.
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
 .option("--files <files...>", "files parameter", [])
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Create a package: an index file plus the set of files that make up an OTA bundle. Pass the organisation and application in the x-organisation and x-application headers. Returns the created package with its assigned version. Requires a bearer token.:

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
    --tag <string> (optional) : Optional tag to identify the package.
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
 .option("--resources <resources...>", "resources parameter", [])
 .option("--rollback_sensitive <rollback_sensitive>", "rollback_sensitive parameter (allowed values: security, one_way_migration)", (value) => {
  const allowedValues = ["security", "one_way_migration"];
  if (!allowedValues.includes(value)) {
    throw new Error("--rollback_sensitive must be one of: security, one_way_migration");
  }
  return value;
})
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Create a new release. A release points a package (and any resources) at a set of targeting dimensions; ramp it later to roll it out. Pass the organisation and application in the x-organisation and x-application headers. Returns the created release with its resolved config and package. Returns 409 if another release is already ongoing for the same dimensions. Requires a bearer token.:

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
    --rollback_sensitive <security | one_way_migration> (optional) : Optional declared reason this release needs additional rollback protection.
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
  "rollback_sensitive": "example_rollback_sensitive",
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
  .command("DeleteControlCenterGroup")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--id <id>", "id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Delete a group by UUID. Requires Bearer authentication and x-organisation. Only organisation admins/owners can delete groups.:

Usage 1 - Individual options:
  $ airborne-core-cli DeleteControlCenterGroup \\
     --id <id> \\
     --organisation <organisation> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli DeleteControlCenterGroup @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli DeleteControlCenterGroup @params.json --id <value> --organisation <value> --token <value>

Parameters:
    --id <string> (required)
    --organisation <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli DeleteControlCenterGroup \\
     --id <id> \\
     --organisation <organisation> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli DeleteControlCenterGroup @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli DeleteControlCenterGroup @params.json --id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "id": "example_id",
  "organisation": "example_organisation",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await DeleteControlCenterGroupAction(paramsFile, options);
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
 Delete a dimension by name. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.:

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
  .command("DiscardRelease")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--release_id <release_id>", "release_id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--change_reason <change_reason>", "change_reason parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Discard a release that has not been ramped, so it never serves traffic. Only a release in the created state can be discarded; a ramped release must be concluded on "control" or rolled back instead, and a release that is already concluded or discarded returns 409. Unknown release ids return 404. Discarding never needs approval. Pass the organisation and application in the x-organisation and x-application headers. Returns 409 with "code: unresolved" when an upstream outcome is unknown. Requires a bearer token and release discard permission.:

Usage 1 - Individual options:
  $ airborne-core-cli DiscardRelease \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--change_reason <change_reason>]

Usage 2 - JSON file:
  airborne-core-cli DiscardRelease @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli DiscardRelease @params.json --release_id <value> --organisation <value> --token <value>

Parameters:
    --release_id <string> (required) : ID of the release (the experiment id returned by CreateRelease).
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --change_reason <string> (optional) : Optional reason recorded upstream. It must not contain the reserved, case-sensitive text "Airborne operation", and with the generated suffix it must fit Superposition's 255-byte limit, so it is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli DiscardRelease \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--change_reason <change_reason>]

2. Using JSON file:
   $ airborne-core-cli DiscardRelease @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli DiscardRelease @params.json --release_id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "release_id": "example_release_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "change_reason": "example_change_reason",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await DiscardReleaseAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("GetControlCenterApprovalPolicy")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Return the application's current approval policy. An absent row returns disabled, empty rosters, a 24-hour TTL and emergency rollback enabled.:

Usage 1 - Individual options:
  $ airborne-core-cli GetControlCenterApprovalPolicy \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli GetControlCenterApprovalPolicy @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli GetControlCenterApprovalPolicy @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli GetControlCenterApprovalPolicy \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli GetControlCenterApprovalPolicy @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli GetControlCenterApprovalPolicy @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await GetControlCenterApprovalPolicyAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("GetControlCenterDeploymentRequest")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--id <id>", "id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Fetch one request by UUID independently of queue pagination. Both scope headers are required.:

Usage 1 - Individual options:
  $ airborne-core-cli GetControlCenterDeploymentRequest \\
     --id <id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli GetControlCenterDeploymentRequest @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli GetControlCenterDeploymentRequest @params.json --id <value> --organisation <value> --token <value>

Parameters:
    --id <string> (required)
    --organisation <string> (required)
    --application <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli GetControlCenterDeploymentRequest \\
     --id <id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli GetControlCenterDeploymentRequest @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli GetControlCenterDeploymentRequest @params.json --id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "id": "example_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await GetControlCenterDeploymentRequestAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("GetControlCenterOverview")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')

 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Return the authenticated user's release overview across accessible organisations and applications. No x-organisation or x-application header is required.:

Usage 1 - Individual options:
  $ airborne-core-cli GetControlCenterOverview \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli GetControlCenterOverview @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli GetControlCenterOverview @params.json --token <value>

Parameters:
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli GetControlCenterOverview \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli GetControlCenterOverview @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli GetControlCenterOverview @params.json --token <value>

JSON file format (params.json):
{
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await GetControlCenterOverviewAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("GetControlCenterReleaseEvents")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--release_id <release_id>", "release_id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Return the ordered audit timeline for a release. Requires Bearer authentication plus x-organisation and x-application headers.:

Usage 1 - Individual options:
  $ airborne-core-cli GetControlCenterReleaseEvents \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli GetControlCenterReleaseEvents @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli GetControlCenterReleaseEvents @params.json --release_id <value> --organisation <value> --token <value>

Parameters:
    --release_id <string> (required)
    --organisation <string> (required)
    --application <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli GetControlCenterReleaseEvents \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli GetControlCenterReleaseEvents @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli GetControlCenterReleaseEvents @params.json --release_id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "release_id": "example_release_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await GetControlCenterReleaseEventsAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("GetControlCenterRollbackPreview")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--release_id <release_id>", "release_id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Compute the rollback decision and package/config reconciliation without persisting an operation or changing upstream, audit, journal, or cache state. Requires release read permission and organisation/application scope headers.:

Usage 1 - Individual options:
  $ airborne-core-cli GetControlCenterRollbackPreview \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli GetControlCenterRollbackPreview @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli GetControlCenterRollbackPreview @params.json --release_id <value> --organisation <value> --token <value>

Parameters:
    --release_id <string> (required)
    --organisation <string> (required)
    --application <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli GetControlCenterRollbackPreview \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli GetControlCenterRollbackPreview @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli GetControlCenterRollbackPreview @params.json --release_id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "release_id": "example_release_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await GetControlCenterRollbackPreviewAction(paramsFile, options);
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
 Get a single release by its id, including its config, package, resources, targeting dimensions, and experiment details. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.:

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
  .command("GetServingPolicy")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Read stored and effective strict serving policy.:

Usage 1 - Individual options:
  $ airborne-core-cli GetServingPolicy \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli GetServingPolicy @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli GetServingPolicy @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli GetServingPolicy \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli GetServingPolicy @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli GetServingPolicy @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await GetServingPolicyAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("GetTelemetrySummary")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 undefined:

Usage 1 - Individual options:
  $ airborne-core-cli GetTelemetrySummary \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli GetTelemetrySummary @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli GetTelemetrySummary @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli GetTelemetrySummary \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli GetTelemetrySummary @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli GetTelemetrySummary @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await GetTelemetrySummaryAction(paramsFile, options);
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
 Get the authenticated user's profile, including the organisations they belong to and the caller's access level in each. Requires a bearer token.:

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
  .command("IngestTelemetryReports")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--receipt <receipt>", "receipt parameter")
 .option("--install_id <install_id>", "install_id parameter")
 .option("--events <events...>", "events parameter", [])
  .description(`
 Optional unverified device reports. 400 drops invalid/expired receipts; 429 retries later; 503 means disabled/unavailable.:

Usage 1 - Individual options:
  $ airborne-core-cli IngestTelemetryReports \\
     --receipt <receipt> \\
     --install_id <install_id> \\
     --events <events>

Usage 2 - JSON file:
  airborne-core-cli IngestTelemetryReports @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli IngestTelemetryReports @params.json --receipt <value> --install_id <value>

Parameters:
    --receipt <string> (required)
    --install_id <string> (required)
    --events (required)
        undefined (optional)
            id <string> (required)
            kind <string> (required)

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli IngestTelemetryReports \\
     --receipt <receipt> \\
     --install_id <install_id> \\
     --events <events>

2. Using JSON file:
   $ airborne-core-cli IngestTelemetryReports @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli IngestTelemetryReports @params.json --receipt <value> --install_id <value>

JSON file format (params.json):
{
  "receipt": "example_receipt",
  "install_id": "example_install_id",
  "events": "example_events"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await IngestTelemetryReportsAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ListControlCenterDeploymentRequests")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--status <status>", "status parameter (allowed values: pending, executing, executed, failed, rejected, cancelled, expired, stale)", (value) => {
  const allowedValues = ["pending", "executing", "executed", "failed", "rejected", "cancelled", "expired", "stale"];
  if (!allowedValues.includes(value)) {
    throw new Error("--status must be one of: pending, executing, executed, failed, rejected, cancelled, expired, stale");
  }
  return value;
})
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List the newest deployment requests. Status filtering precedes the 1,000-row cap. Omit x-application to list across the organisation, with per-application read filtering.:

Usage 1 - Individual options:
  $ airborne-core-cli ListControlCenterDeploymentRequests \\
     --organisation <organisation> \\
     --token <string> \\
     [--application <application>]

Usage 2 - JSON file:
  airborne-core-cli ListControlCenterDeploymentRequests @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ListControlCenterDeploymentRequests @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (optional) : Optional: omit x-application to list readable requests across the organisation. Filter is applied before the 1,000 newest-row cap.
    --status <pending | executing | executed | failed | rejected | cancelled | expired | stale> (optional)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ListControlCenterDeploymentRequests \\
     --organisation <organisation> \\
     --token <string> \\
     [--application <application>]

2. Using JSON file:
   $ airborne-core-cli ListControlCenterDeploymentRequests @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ListControlCenterDeploymentRequests @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "status": "example_status",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await ListControlCenterDeploymentRequestsAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ListControlCenterGroups")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List groups for the organisation in x-organisation. Member applications are filtered to those the caller can read. Requires Bearer authentication.:

Usage 1 - Individual options:
  $ airborne-core-cli ListControlCenterGroups \\
     --organisation <organisation> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli ListControlCenterGroups @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ListControlCenterGroups @params.json --organisation <value> --token <value>

Parameters:
    --organisation <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ListControlCenterGroups \\
     --organisation <organisation> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli ListControlCenterGroups @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ListControlCenterGroups @params.json --organisation <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await ListControlCenterGroupsAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("ListControlCenterOperations")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--status <status>", "status parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List unresolved upstream write outcomes for an application. Requires Bearer authentication, scope headers, and release read access.:

Usage 1 - Individual options:
  $ airborne-core-cli ListControlCenterOperations \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--status <status>]

Usage 2 - JSON file:
  airborne-core-cli ListControlCenterOperations @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ListControlCenterOperations @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --status <string> (optional)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ListControlCenterOperations \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--status <status>]

2. Using JSON file:
   $ airborne-core-cli ListControlCenterOperations @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ListControlCenterOperations @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "status": "example_status",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await ListControlCenterOperationsAction(paramsFile, options);
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
 List the targeting dimensions defined for an application, in priority order, with pagination. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.:

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
    --page <integer> (optional) : Page number for pagination.
    --count <integer> (optional) : Number of dimensions per page.
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
  .command("ListFileGroups")
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
 .option("--tags <tags>", "tags parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List files grouped by path, so that all versions and tags of a file appear together. Supports pagination and optional search and tag filters. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.:

Usage 1 - Individual options:
  $ airborne-core-cli ListFileGroups \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--page <page>]

Usage 2 - JSON file:
  airborne-core-cli ListFileGroups @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ListFileGroups @params.json --page <value> --count <value> --token <value>

Parameters:
    --page <integer> (optional) : Page number for pagination
    --count <integer> (optional) : Number of groups per page
    --search <string> (optional) : Search query to filter files by path
    --tags <string> (optional) : Tags to filter files by (comma-separated for multiple values)
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ListFileGroups \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--page <page>]

2. Using JSON file:
   $ airborne-core-cli ListFileGroups @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ListFileGroups @params.json --page <value> --count <value> --token <value>

JSON file format (params.json):
{
  "page": 123,
  "count": 123,
  "search": "example_search",
  "tags": "example_tags",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await ListFileGroupsAction(paramsFile, options);
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
 .option("--tags <tags>", "tags parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List files for an application, with pagination and optional search and tag filters. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.:

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
    --tags <string> (optional) : Tags to filter files by (comma-separated for multiple values, e.g., "prod,dev,staging")
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
  "tags": "example_tags",
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
 List all organisations the authenticated user belongs to, along with their applications and the caller's access level in each. Requires a bearer token.:

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
 .option("--all <all>", "all parameter", (value) => {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new Error("--all must be true or false");
})
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List packages for an application, with pagination and optional search by index file path. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.:

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
 .option("--all <all>", "all parameter", (value) => {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new Error("--all must be true or false");
})
 .option("--status <status>", "status parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 List releases for an application, with pagination and optional filtering by status or targeting dimension. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.:

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
 Exchange user credentials (client_id and client_secret) for an access token and a refresh token. Public — no auth token required. Call this first, then send the returned access token as a bearer token on subsequent requests.:

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
  .command("PreviewServingPolicy")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--context <context>", "context parameter")
 .option("--toss <toss>", "toss parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Read-only evaluation of one context and toss. Returns whether enabling strict serving removes default fallback; this is not a population-wide impact count.:

Usage 1 - Individual options:
  $ airborne-core-cli PreviewServingPolicy \\
     --organisation <organisation> \\
     --application <application> \\
     --context <context> \\
     --toss <toss> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli PreviewServingPolicy @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli PreviewServingPolicy @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --context (required)
        key <string>
        value <string>
    --toss <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli PreviewServingPolicy \\
     --organisation <organisation> \\
     --application <application> \\
     --context <context> \\
     --toss <toss> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli PreviewServingPolicy @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli PreviewServingPolicy @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "context": "example_context",
  "toss": "example_toss",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await PreviewServingPolicyAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("PutServingPolicy")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--strict <strict>", "strict parameter", (value) => {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new Error("--strict must be true or false");
})
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Change strict serving. Requires release update permission. Both directions require set_strict_serving approval when maker-checker is enabled. Payload body is {strict: boolean}, without release_id.:

Usage 1 - Individual options:
  $ airborne-core-cli PutServingPolicy \\
     --organisation <organisation> \\
     --application <application> \\
     --strict <strict> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli PutServingPolicy @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli PutServingPolicy @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --strict <boolean> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli PutServingPolicy \\
     --organisation <organisation> \\
     --application <application> \\
     --strict <strict> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli PutServingPolicy @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli PutServingPolicy @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "strict": "example_strict",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await PutServingPolicyAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("RampRelease")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--release_id <release_id>", "release_id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--traffic_percentage <traffic_percentage>", "traffic_percentage parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--traffic_percentage must be a valid integer");
  }
  return parsed;
})
 .option("--change_reason <change_reason>", "change_reason parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Set the share of traffic that receives a release. A release starts at 0% and is not served until it is ramped; the first ramp moves it from created to in progress, and later ramps raise or lower the share. Pass the organisation and application in the x-organisation and x-application headers. Unknown release ids return 404. Values outside 0–50 return 400 before any write is attempted. Explicit upstream 400 and 422 validation rejections for ramps are recorded as not applied and do not pause writes for the application; other uncertain outcomes return 409 with code "unresolved" and own_attempt true, so inspect the real state before retrying and never repeat a committed ramp merely to clear a cache failure. Returns 409 when the release has already concluded or been discarded, and 409 with code "unresolved" when an earlier upstream write for the application still needs recovery; an organisation admin can resolve that operation with ResolveControlCenterOperation. When the application requires approvals, raising traffic (or any ramp of a rollback-sensitive release) is refused with 403 "approval_required"; raise a deployment request instead. Requires a bearer token and release ramp permission.:

Usage 1 - Individual options:
  $ airborne-core-cli RampRelease \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --traffic_percentage <traffic_percentage> \\
     --token <string> \\
     [--change_reason <change_reason>]

Usage 2 - JSON file:
  airborne-core-cli RampRelease @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli RampRelease @params.json --release_id <value> --organisation <value> --token <value>

Parameters:
    --release_id <string> (required) : ID of the release (the experiment id returned by CreateRelease).
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --traffic_percentage <integer> (required) : Percentage of traffic to route to the release, from 0 to 50. Values outside this range return 400 before any write is attempted. Setting it to 0 pauses the release without discarding it. Lowering it needs no approval, raising it does when approvals are enabled.
    --change_reason <string> (optional) : Optional reason recorded upstream. It must not contain the reserved, case-sensitive text "Airborne operation", and with the generated suffix it must fit Superposition's 255-byte limit, so it is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli RampRelease \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --traffic_percentage <traffic_percentage> \\
     --token <string> \\
     [--change_reason <change_reason>]

2. Using JSON file:
   $ airborne-core-cli RampRelease @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli RampRelease @params.json --release_id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "release_id": "example_release_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "traffic_percentage": 123,
  "change_reason": "example_change_reason",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await RampReleaseAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("RejectControlCenterDeploymentRequest")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--id <id>", "id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--reason <reason>", "reason parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Reject a request. A checker may reject their own request; a reason is required.:

Usage 1 - Individual options:
  $ airborne-core-cli RejectControlCenterDeploymentRequest \\
     --id <id> \\
     --organisation <organisation> \\
     --application <application> \\
     --reason <reason> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli RejectControlCenterDeploymentRequest @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli RejectControlCenterDeploymentRequest @params.json --id <value> --organisation <value> --token <value>

Parameters:
    --id <string> (required)
    --organisation <string> (required)
    --application <string> (required)
    --reason <string> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli RejectControlCenterDeploymentRequest \\
     --id <id> \\
     --organisation <organisation> \\
     --application <application> \\
     --reason <reason> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli RejectControlCenterDeploymentRequest @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli RejectControlCenterDeploymentRequest @params.json --id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "id": "example_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "reason": "example_reason",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await RejectControlCenterDeploymentRequestAction(paramsFile, options);
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
 Submit a request to have an organisation provisioned (for onboarding flows that require manual approval), including contact details and store links. Returns a confirmation message. Requires a bearer token.:

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
  .command("ResolveControlCenterOperation")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--id <id>", "id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--finding <finding>", "finding parameter (allowed values: did_not_apply, applied)", (value) => {
  const allowedValues = ["did_not_apply", "applied"];
  if (!allowedValues.includes(value)) {
    throw new Error("--finding must be one of: did_not_apply, applied");
  }
  return value;
})
 .option("--reason <reason>", "reason parameter")
 .option("--request_terminated <request_terminated>", "request_terminated parameter", (value) => {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new Error("--request_terminated must be true or false");
})
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Resolve an unresolved operation after upstream verification. Only organisation owners/admins or super admins may recover. applied needs positive evidence of the expected change, matched through the operation's generated marker in current upstream state or its audit history. did_not_apply needs the experiment and the application's workspace configuration (defaults, contexts, overrides) to be unchanged from the values saved before the write, plus the operator's confirmation that the original request has terminated. A 409 names the changed config keys or contexts: restore them, or finish the intended change and resolve as applied. Operations created before this evidence was saved cannot be resolved as did_not_apply. The reason must not contain the reserved text "Airborne operation". Markers are not authenticated provenance: anyone who can write to Superposition directly can forge one, so restrict direct upstream write access to trusted operators.:

Usage 1 - Individual options:
  $ airborne-core-cli ResolveControlCenterOperation \\
     --id <id> \\
     --organisation <organisation> \\
     --application <application> \\
     --finding <finding> \\
     --reason <reason> \\
     --token <string> \\
     [--request_terminated <request_terminated>]

Usage 2 - JSON file:
  airborne-core-cli ResolveControlCenterOperation @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ResolveControlCenterOperation @params.json --id <value> --organisation <value> --token <value>

Parameters:
    --id <string> (required)
    --organisation <string> (required)
    --application <string> (required)
    --finding <did_not_apply | applied> (required)
    --reason <string> (required) : Required and non-blank; the operator's reason is recorded in the audit event. It must not contain the reserved text "Airborne operation"; such a reason returns 400.
    --request_terminated <boolean> (optional) : Must be true for did_not_apply. The operator confirms the original request cannot execute later.
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ResolveControlCenterOperation \\
     --id <id> \\
     --organisation <organisation> \\
     --application <application> \\
     --finding <finding> \\
     --reason <reason> \\
     --token <string> \\
     [--request_terminated <request_terminated>]

2. Using JSON file:
   $ airborne-core-cli ResolveControlCenterOperation @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ResolveControlCenterOperation @params.json --id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "id": "example_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "finding": "example_finding",
  "reason": "example_reason",
  "request_terminated": "example_request_terminated",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await ResolveControlCenterOperationAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("RollbackRelease")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--release_id <release_id>", "release_id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--reason <reason>", "reason parameter")
 .option("--emergency <emergency>", "emergency parameter", (value) => {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new Error("--emergency must be true or false");
})
 .option("--confirm_sensitive_risk <confirm_sensitive_risk>", "confirm_sensitive_risk parameter", (value) => {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new Error("--confirm_sensitive_risk must be true or false");
})
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Roll back a release according to its lifecycle state. Writes are durable and retries of a completed operation return its recorded success, including later unrelated live-release diagnostics. Unknown upstream outcomes return 409 unresolved and require real-state/operator review; changed replacements return 409 replacement_changed and must not be resumed automatically. Re-release only works while the source is the latest live release for its dimensions. Requires Bearer authentication plus x-organisation and x-application; callers need release write/conclude permission.:

Usage 1 - Individual options:
  $ airborne-core-cli RollbackRelease \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --reason <reason> \\
     --token <string> \\
     [--emergency <emergency>]

Usage 2 - JSON file:
  airborne-core-cli RollbackRelease @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli RollbackRelease @params.json --release_id <value> --organisation <value> --token <value>

Parameters:
    --release_id <string> (required)
    --organisation <string> (required)
    --application <string> (required)
    --reason <string> (required) : The reason must not contain the reserved, case-sensitive text "Airborne operation": Airborne appends a generated suffix made of "[Airborne operation ", a canonical UUID and "]" to the reason it sends upstream, and the combined text must fit Superposition's 255-byte limit, so a reason is limited to 197 bytes. A reserved or oversized reason returns 400 before anything is dispatched.
    --emergency <boolean> (optional) : Use only for the constrained emergency rollback path.
    --confirm_sensitive_risk <boolean> (optional) : Required when the latest live source is marked rollback-sensitive.
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli RollbackRelease \\
     --release_id <release_id> \\
     --organisation <organisation> \\
     --application <application> \\
     --reason <reason> \\
     --token <string> \\
     [--emergency <emergency>]

2. Using JSON file:
   $ airborne-core-cli RollbackRelease @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli RollbackRelease @params.json --release_id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "release_id": "example_release_id",
  "organisation": "example_organisation",
  "application": "example_application",
  "reason": "example_reason",
  "emergency": "example_emergency",
  "confirm_sensitive_risk": "example_confirm_sensitive_risk",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await RollbackReleaseAction(paramsFile, options);
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
 .option("--telemetry_platform <telemetry_platform>", "telemetry_platform parameter")
 .option("--native_version <native_version>", "native_version parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Resolve and return the active release configuration for an application, given the caller's targeting dimensions. This is the endpoint the SDK calls at boot. Public — no auth token required.:

Usage 1 - Individual options:
  $ airborne-core-cli ServeRelease \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--telemetry_platform <telemetry_platform>]

Usage 2 - JSON file:
  airborne-core-cli ServeRelease @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ServeRelease @params.json --telemetry_platform <value> --native_version <value> --token <value>

Parameters:
    --telemetry_platform <string> (optional)
    --native_version <string> (optional)
    --organisation <string> (required) : Name of the organisation.
    --application <string> (required) : Name of the application.
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ServeRelease \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--telemetry_platform <telemetry_platform>]

2. Using JSON file:
   $ airborne-core-cli ServeRelease @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ServeRelease @params.json --telemetry_platform <value> --native_version <value> --token <value>

JSON file format (params.json):
{
  "telemetry_platform": "example_telemetry_platform",
  "native_version": "example_native_version",
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
 .option("--telemetry_platform <telemetry_platform>", "telemetry_platform parameter")
 .option("--native_version <native_version>", "native_version parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Version 2 of the release-resolution endpoint: resolves and returns the active release configuration for an application based on the caller's targeting dimensions. This is the endpoint newer SDKs call at boot. Public — no auth token required.:

Usage 1 - Individual options:
  $ airborne-core-cli ServeReleaseV2 \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--telemetry_platform <telemetry_platform>]

Usage 2 - JSON file:
  airborne-core-cli ServeReleaseV2 @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli ServeReleaseV2 @params.json --telemetry_platform <value> --native_version <value> --token <value>

Parameters:
    --telemetry_platform <string> (optional)
    --native_version <string> (optional)
    --organisation <string> (required) : Name of the organisation.
    --application <string> (required) : Name of the application.
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli ServeReleaseV2 \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--telemetry_platform <telemetry_platform>]

2. Using JSON file:
   $ airborne-core-cli ServeReleaseV2 @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli ServeReleaseV2 @params.json --telemetry_platform <value> --native_version <value> --token <value>

JSON file format (params.json):
{
  "telemetry_platform": "example_telemetry_platform",
  "native_version": "example_native_version",
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
  .command("UpdateControlCenterApprovalPolicy")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--enabled <enabled>", "enabled parameter", (value) => {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new Error("--enabled must be true or false");
})
 .option("--makers <makers...>", "makers parameter", [])
 .option("--checkers <checkers...>", "checkers parameter", [])
 .option("--request_ttl_hours <request_ttl_hours>", "request_ttl_hours parameter", (value) => {
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error("--request_ttl_hours must be a valid integer");
  }
  return parsed;
})
 .option("--emergency_rollback <emergency_rollback>", "emergency_rollback parameter", (value) => {
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;
  throw new Error("--emergency_rollback must be true or false");
})
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Replace the application's approval policy. Only actual organisation owners/admins may edit it. Roster identities must be enabled Keycloak users with app access and ordinary release permissions. Enabling requires at least two distinct subjects and a different eligible checker for each maker. Returns 409 until the operator deployment readiness fence is attested after all old instances and writes are drained.:

Usage 1 - Individual options:
  $ airborne-core-cli UpdateControlCenterApprovalPolicy \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--enabled <enabled>]

Usage 2 - JSON file:
  airborne-core-cli UpdateControlCenterApprovalPolicy @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli UpdateControlCenterApprovalPolicy @params.json --organisation <value> --application <value> --token <value>

Parameters:
    --organisation <string> (required)
    --application <string> (required)
    --enabled <boolean> (optional)
    --makers [<string>] (optional)
    --checkers [<string>] (optional)
    --request_ttl_hours <integer> (optional)
    --emergency_rollback <boolean> (optional)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli UpdateControlCenterApprovalPolicy \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string> \\
     [--enabled <enabled>]

2. Using JSON file:
   $ airborne-core-cli UpdateControlCenterApprovalPolicy @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli UpdateControlCenterApprovalPolicy @params.json --organisation <value> --application <value> --token <value>

JSON file format (params.json):
{
  "organisation": "example_organisation",
  "application": "example_application",
  "enabled": "example_enabled",
  "makers": "example_makers",
  "checkers": "example_checkers",
  "request_ttl_hours": 123,
  "emergency_rollback": "example_emergency_rollback",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await UpdateControlCenterApprovalPolicyAction(paramsFile, options);
      console.log(printColoredJSON(output));
      process.exit(0);
    } catch (err) {
      console.error("Error message:", err.message);
      console.error("Error executing:", printColoredJSON(err));
      process.exit(1);
    }
  });


program
  .command("UpdateControlCenterGroup")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--id <id>", "id parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--name <name>", "name parameter")
 .option("--members <members...>", "members parameter", [])
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Replace a group's name and complete member list. Requires Bearer authentication and x-organisation. Only organisation admins/owners can update groups.:

Usage 1 - Individual options:
  $ airborne-core-cli UpdateControlCenterGroup \\
     --id <id> \\
     --organisation <organisation> \\
     --name <name> \\
     --members <members> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli UpdateControlCenterGroup @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli UpdateControlCenterGroup @params.json --id <value> --organisation <value> --token <value>

Parameters:
    --id <string> (required)
    --organisation <string> (required)
    --name <string> (required)
    --members (required)
        undefined (optional)
            application <string> (required)
            platform <android | ios | web | other> (required)
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli UpdateControlCenterGroup \\
     --id <id> \\
     --organisation <organisation> \\
     --name <name> \\
     --members <members> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli UpdateControlCenterGroup @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli UpdateControlCenterGroup @params.json --id <value> --organisation <value> --token <value>

JSON file format (params.json):
{
  "id": "example_id",
  "organisation": "example_organisation",
  "name": "example_name",
  "members": "example_members",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await UpdateControlCenterGroupAction(paramsFile, options);
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
 Update a dimension, identified by name in the path — for example to change its priority position. Pass the organisation and application in the x-organisation and x-application headers. Requires a bearer token.:

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
  .command("UpdateFile")
  .argument('[params_file]', 'JSON file containing all parameters (use @params.json format)')
 .option("--file_key <file_key>", "file_key parameter")
 .option("--tag <tag>", "tag parameter")
 .option("--organisation <organisation>", "organisation parameter")
 .option("--application <application>", "application parameter")
 .option("--token <token>", "Bearer token for authentication")
  .description(`
 Update the tag of an existing file, identified by its file key in the path (a file path with a version or tag, e.g. "path/to/file@version:3" or "path/to/file@tag:prod"). Pass the organisation and application in the x-organisation and x-application headers. Returns the updated file. Requires a bearer token.:

Usage 1 - Individual options:
  $ airborne-core-cli UpdateFile \\
     --file_key <file_key> \\
     --tag <tag> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

Usage 2 - JSON file:
  airborne-core-cli UpdateFile @file.json

Usage 3 - Mixed Usage:
  $ airborne-core-cli UpdateFile @params.json --file_key <value> --tag <value> --token <value>

Parameters:
    --file_key <string> (required) : The file key in the path (e.g., "$file_path@version:$version_number" or "$file_path@tag:$tag")
    --tag <string> (required) : New tag to update the file with
    --organisation <string> (required) : Name of the organisation
    --application <string> (required) : Name of the application
    --token <string> (required) : Bearer token for authentication

`)
  .usage('<action> [options]')
  .addHelpText('after', `
Examples:

1. Using individual options:
   $ airborne-core-cli UpdateFile \\
     --file_key <file_key> \\
     --tag <tag> \\
     --organisation <organisation> \\
     --application <application> \\
     --token <string>

2. Using JSON file:
   $ airborne-core-cli UpdateFile @params.json

3. Mixed approach (JSON file + CLI overrides):
   $ airborne-core-cli UpdateFile @params.json --file_key <value> --tag <value> --token <value>

JSON file format (params.json):
{
  "file_key": "example_file_key",
  "tag": "example_tag",
  "organisation": "example_organisation",
  "application": "example_application",
  "token": "your_bearer_token_here"
}`)
  .action(async (paramsFile, options) => {
    try {

      const output = await UpdateFileAction(paramsFile, options);
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
 Upload a file's bytes directly as the request body and register it in one step. Send the raw file as the payload, with its Base64-encoded SHA-256 digest in the x-checksum header and the organisation and application in the x-organisation and x-application headers. Returns the created file. Requires a bearer token.:

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
    --organisation <string> (required) : Name of the organisation
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