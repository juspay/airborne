import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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