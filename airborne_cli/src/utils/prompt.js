import readline from "readline";

function createPromptInterface() {
  return readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
}

export function promptUser(question) {
  return new Promise((resolve) => {
    const rl = createPromptInterface();
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function promptWithType(
  question,
  expectedType,
  defaultValue,
  retries = 2
) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const answer = (await promptUser(question)).trim();

    // 1️⃣ Use default if input is empty and default is provided
    if (answer === "" && defaultValue !== undefined) {
      return defaultValue;
    }

    let isValid = false;
    let parsed = answer;

    if (Array.isArray(expectedType)) {
      const lower = answer.toLowerCase();
      isValid = expectedType.map((v) => v.toLowerCase()).includes(lower);
      if (isValid) parsed = lower;
    } else {
      switch (expectedType) {
        case "number":
          parsed = Number(answer);
          isValid = answer !== "" && !isNaN(parsed); // empty string is invalid
          break;
        case "boolean":
          if (["y", "yes", "true"].includes(answer.toLowerCase())) {
            parsed = true;
            isValid = true;
          } else if (["n", "no", "false"].includes(answer.toLowerCase())) {
            parsed = false;
            isValid = true;
          }
          break;
        case "string":
          parsed = answer;
          isValid = answer.length > 0; // empty string invalid if no default
          break;
        default:
          throw new Error(`Unsupported expectedType: ${expectedType}`);
      }
    }

    if (isValid) {
      return parsed;
    } else if (attempt < retries) {
      const expectedMsg = Array.isArray(expectedType)
        ? `one of: ${expectedType.join(", ")}`
        : expectedType;
      console.log(`❌ Invalid input. Expected ${expectedMsg}. Try again.`);
    }
  }

  const expectedMsg = Array.isArray(expectedType)
    ? `one of: ${expectedType.join(", ")}`
    : expectedType;
  throw new Error(
    `Failed to provide valid ${expectedMsg} after ${retries + 1} attempts.`
  );
}
