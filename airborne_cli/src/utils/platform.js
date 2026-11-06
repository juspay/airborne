import { InvalidOptionArgumentError } from "commander";

export const PLATFORMS = ["android", "ios", "web"];

/** Commander option parser for `-p, --platform`: case-insensitive, validated. */
export function parsePlatform(value) {
  const lower = value.toLowerCase();
  if (!PLATFORMS.includes(lower)) {
    throw new InvalidOptionArgumentError(
      `Invalid platform: "${value}". Allowed values: ${PLATFORMS.join(" | ")}`
    );
  }
  return lower;
}
