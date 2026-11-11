import type { TargetingRule } from "@/types/release";

export function validCreationTargeting(strict: boolean, rules: TargetingRule[], reason: string): boolean {
  if (!rules.every((r) => Boolean(r.dimension && r.values.trim()))) return false;
  const length = [...reason.trim()].length;
  if (length > 2000) return false;
  if (!strict) return true;
  return (
    rules.length > 0 &&
    (rules.some((r) => ["app_version", "version_cohort"].includes(r.dimension) && r.values.trim()) || length >= 20)
  );
}
