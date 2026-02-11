import fs from "fs";
import { promises as fsPromises } from "fs";
import path from "path";
import { CreateApplicationCommand, CreateDimensionCommand, CreateFileCommand, CreateOrganisationCommand, CreatePackageCommand, CreateReleaseCommand, DeleteDimensionCommand, GetReleaseCommand, GetUserCommand, ListDimensionsCommand, ListFilesCommand, ListOrganisationsCommand, ListPackagesCommand, ListReleasesCommand, PostLoginCommand, RequestOrganisationCommand, ServeReleaseCommand, ServeReleaseV2Command, UpdateDimensionCommand, UploadFileCommand, AirborneClient } from "airborne-server-sdk"
import { fileURLToPath } from 'url';
import { dirname } from 'path';


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

async function getClient(token,isAuthReq){
  const baseUrl = await getBaseUrl();
  
  if(!token || !isAuthReq){
    return new AirborneClient({
      endpoint: baseUrl 
    })
  }
  else{
    return new AirborneClient({
      endpoint: baseUrl,
      token: { token: token },
    })
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

function mergeOptionsWithJsonFile(options, jsonFilePath) {
  const jsonOptions = readJsonFile(jsonFilePath);
  
  // CLI arguments take precedence over JSON file values
  const merged = { ...jsonOptions };
  
  // Override with any CLI arguments that were provided
  Object.keys(options).forEach(key => {
    if (options[key] !== undefined) {
      merged[key] = options[key];
    }
  });
  
  return merged;
}


function validateRequiredOptions(options, requiredParams) {
  const missing = [];
  const getNestedValue = (obj, path) => {
    const parts = path.replace(/\[\]/g, "").split(/\.|\{value\}/); // handle list [] and map {value}
    let current = obj;
    for (const part of parts) {
      if (!current) return undefined;
      current = current[part];
    }
    return current;
  };

  for (const field of requiredParams) {
    // Check if this is a nested field that requires conditional validation
    const fieldParts = field.split('.');
    if (fieldParts.length > 1) {
      // Get the parent path (everything except the last part)
      const parentPath = fieldParts.slice(0, -1).join('.');
      
      // Check if the parent is also in the required params
      const parentIsRequired = requiredParams.includes(parentPath);
      
      // If parent is not required, only validate this field if parent exists
      if (!parentIsRequired) {
        const parentExists = getNestedValue(options, parentPath);
        if (parentExists === undefined || parentExists === null) {
          continue; // Skip validation if parent doesn't exist
        }
      }
    }

    const value = getNestedValue(options, field);
    if (value === undefined || value === null) {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required parameters: ${missing.join(', ')}`);
  }
}
export async function CreateApplicationAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["application","organisation","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new CreateApplicationCommand(finalOptions);
  return await client.send(command);
}

export async function CreateDimensionAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["dimension","description","dimension_type","organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new CreateDimensionCommand(finalOptions);
  return await client.send(command);
}

export async function CreateFileAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["file_path","url","organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  // Handle document fields specially if they're objects from JSON
  if (finalOptions.metadata && typeof finalOptions.metadata === 'object') {
    // Convert object to string if command expects JSON string
    finalOptions.metadata = JSON.stringify(finalOptions.metadata);
  }

  const client = await getClient(finalOptions.token, true);
  const command = new CreateFileCommand(finalOptions);
  return await client.send(command);
}

export async function CreateOrganisationAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["name","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new CreateOrganisationCommand(finalOptions);
  return await client.send(command);
}

export async function CreatePackageAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["index","files","organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new CreatePackageCommand(finalOptions);
  return await client.send(command);
}

export async function CreateReleaseAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["config","config.release_config_timeout","config.boot_timeout","config.properties","organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new CreateReleaseCommand(finalOptions);
  return await client.send(command);
}

export async function DeleteDimensionAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["dimension","organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new DeleteDimensionCommand(finalOptions);
  return await client.send(command);
}

export async function GetReleaseAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["releaseId","organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new GetReleaseCommand(finalOptions);
  return await client.send(command);
}

export async function GetUserAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new GetUserCommand(finalOptions);
  return await client.send(command);
}

export async function ListDimensionsAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new ListDimensionsCommand(finalOptions);
  return await client.send(command);
}

export async function ListFilesAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new ListFilesCommand(finalOptions);
  return await client.send(command);
}

export async function ListOrganisationsAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new ListOrganisationsCommand(finalOptions);
  return await client.send(command);
}

export async function ListPackagesAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new ListPackagesCommand(finalOptions);
  return await client.send(command);
}

export async function ListReleasesAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new ListReleasesCommand(finalOptions);
  return await client.send(command);
}

export async function PostLoginAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["client_id","client_secret"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(null, false);
  const command = new PostLoginCommand(finalOptions);
  return await client.send(command);
}

export async function RequestOrganisationAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["organisation_name","name","email","phone","app_store_link","play_store_link","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new RequestOrganisationCommand(finalOptions);
  return await client.send(command);
}

export async function ServeReleaseAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new ServeReleaseCommand(finalOptions);
  return await client.send(command);
}

export async function ServeReleaseV2Action(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new ServeReleaseV2Command(finalOptions);
  return await client.send(command);
}

export async function UpdateDimensionAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["dimension","change_reason","position","organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  

  
  const client = await getClient(finalOptions.token, true);
  const command = new UpdateDimensionCommand(finalOptions);
  return await client.send(command);
}

export async function UploadFileAction(paramsFile, options){
  let finalOptions = {};
  const requiredParams = ["file","file_path","checksum","organisation","application","token"];

  if (paramsFile && paramsFile.startsWith('@')) {
    const jsonFilePath = paramsFile.slice(1); 
    finalOptions = mergeOptionsWithJsonFile(options, jsonFilePath, requiredParams);
  } else if (paramsFile) {
    throw new Error("Params file must start with @ (e.g., @params.json)");
  } else {
    finalOptions = options;
  }

  // Validate that all required options are present
  validateRequiredOptions(finalOptions, requiredParams);

  // Handle blob fields recursively at all levels
  if (finalOptions.file) {
    // For streaming blobs, create a readable stream
    const filePathfile = path.resolve(finalOptions.file);
    if (!fs.existsSync(filePathfile)) {
      throw new Error(`File not found: ${filePathfile}`);
    }
    finalOptions.file = fs.createReadStream(filePathfile);
  }


  
  const client = await getClient(finalOptions.token, true);
  const command = new UploadFileCommand(finalOptions);
  return await client.send(command);
}
