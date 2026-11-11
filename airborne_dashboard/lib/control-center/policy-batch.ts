import { isUnconfirmedWrite } from "./write-outcome";
/** Non-atomic policy application. A rejected promise does not prove that a write failed. */
export async function applyPolicyBatch(apps: string[], write: (app: string) => Promise<unknown>) {
  const results: { app: string; ok: boolean; message: string }[] = [];
  for (const [index, app] of apps.entries()) {
    try {
      await write(app);
      results.push({ app, ok: true, message: "Policy saved" });
    } catch (error) {
      results.push({
        app,
        ok: false,
        message: isUnconfirmedWrite(error)
          ? `Outcome unconfirmed. Re-read this application’s policy before retrying. ${error instanceof Error ? error.message : String(error)}`
          : `Policy refused; nothing changed. ${error instanceof Error ? error.message : String(error)}`,
      });
      for (const skipped of apps.slice(index + 1)) {
        results.push({ app: skipped, ok: false, message: "Not attempted; the batch stopped at the first error." });
      }
      break;
    }
  }
  return results;
}
