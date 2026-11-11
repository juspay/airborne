export function loginErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid_grant|invalid.*credentials/i.test(message)
    ? "The email or password is incorrect. Please try again."
    : "Could not sign in. Please check your connection and try again.";
}
