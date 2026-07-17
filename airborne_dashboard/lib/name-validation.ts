export const ORG_APP_NAME_MAX_LENGTH = 50;
export const ORG_APP_NAME_RULE_TEXT = "Use only a-z, 0-9, -, _, .";

const ORG_APP_NAME_REGEX = /^[a-z0-9._-]+$/;

export function validateOrgAppName(value: string, label: "Organisation" | "Application"): string | null {
  if (value.trim().length === 0) {
    return `${label} name is required`;
  }

  if (value.length > ORG_APP_NAME_MAX_LENGTH) {
    return `${label} name must be at most ${ORG_APP_NAME_MAX_LENGTH} characters`;
  }

  if (!ORG_APP_NAME_REGEX.test(value)) {
    return `${label} name can only contain: a-z, 0-9, -, _, .`;
  }

  return null;
}

export const SIGNING_KEY_ID_MAX_LENGTH = 50;
export const SIGNING_KEY_ID_RULE_TEXT =
  "Use lowercase letters (a-z), digits (0-9), and dashes. Dashes cannot be consecutive or appear at the start or end.";

const SIGNING_KEY_ID_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Mirrors the server's `validate_key_id`, so a bad ID is caught before the request. */
export function validateSigningKeyId(value: string): string | null {
  if (value.length === 0) {
    return "Key ID is required";
  }

  if (value.length > SIGNING_KEY_ID_MAX_LENGTH) {
    return `Key ID must be at most ${SIGNING_KEY_ID_MAX_LENGTH} characters`;
  }

  if (!SIGNING_KEY_ID_REGEX.test(value)) {
    return "Key ID may only contain lowercase letters, digits, and dashes; dashes cannot be consecutive or appear at the start or end";
  }

  return null;
}
