import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type ParsedFileRef = {
  filePath: string;
  version?: number;
  tag?: string;
};

export function parseFileRef(input: string): ParsedFileRef {
  const s = input.trim();

  // Match: <anything>@(version|tag):<value>
  // The (.*) is greedy, so it binds to the last '@' before 'version|tag'.
  const m = s.match(/^(.*)@(?:(version|tag):(.+))$/);

  if (!m) {
    return { filePath: s };
  }

  const [, filePathRaw, kind, valueRaw] = m;
  const filePath = filePathRaw;
  const value = valueRaw.trim();

  if (kind === "version") {
    const num = Number(value);
    if (!Number.isInteger(num)) {
      throw new Error(`Invalid version: "${value}" (must be an integer)`);
    }
    return { filePath, version: num };
  }

  // kind === "tag"
  return { filePath, tag: value };
}

export function parseSubGroupFileRef(input: string): { groupId: string; version: number } {
  const s = input.trim();
  const parts = s.split("@");
  if (parts.length !== 2) {
    throw new Error(`Invalid sub-package reference: "${input}" (expected format: "groupId@version")`);
  }
  const groupId = parts[0];
  const versionStr = parts[1];
  const version = Number(versionStr);
  if (!Number.isInteger(version)) {
    throw new Error(`Invalid version in sub-package reference: "${versionStr}" (must be an integer)`);
  }
  return { groupId, version };
}

export function hasAppAccess(orgAccess: string[], appAccess: string[], accessType?: string): boolean {
  // Check if org has admin
  if (orgAccess.includes("admin")) return true;

  // Check if org has read and app has write
  if (orgAccess.includes("read") && appAccess.includes(accessType ? accessType : "write")) return true;

  // Otherwise, no access
  return false;
}
