const assert = require("node:assert/strict");
const { load, test } = require("./harness.cjs");
test("password rejection has a friendly message without exposing provider errors", () => {
  const { loginErrorMessage } = load("lib/login-error");
  assert.equal(
    loginErrorMessage(new Error("invalid_grant: Invalid user credentials")),
    "The email or password is incorrect. Please try again."
  );
  assert.equal(
    loginErrorMessage(new Error("Failed to fetch")),
    "Could not sign in. Please check your connection and try again."
  );
});
