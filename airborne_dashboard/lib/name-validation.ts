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
