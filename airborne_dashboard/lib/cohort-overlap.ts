// Which existing version cohorts a new range would overlap. A cohort is a version comparison (or an `and` of two)
// over one dimension, and the first match in the dimension's order wins, so a range placed before an overlapping band
// takes its devices. Only the semver comparators are understood; anything else is left out rather than guessed at.

export interface VersionBounds {
  lower: { value: number[]; inclusive: boolean } | null;
  upper: { value: number[]; inclusive: boolean } | null;
}

const asRecord = (v: unknown): Record<string, unknown> | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;

const parse = (v: unknown): number[] | null =>
  typeof v === "string" && /^\d+\.\d+\.\d+$/.test(v) ? v.split(".").map(Number) : null;

const compare = (a: number[], b: number[]) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** The bounds a cohort definition puts on the version, or null when it is not a semver comparison we understand. */
export function versionBounds(definition: unknown): VersionBounds | null {
  const d = asRecord(definition);
  if (!d) return null;
  const nodes = Array.isArray(d.and) ? d.and : [d];
  const bounds: VersionBounds = { lower: null, upper: null };
  for (const node of nodes) {
    const n = asRecord(node);
    if (!n) return null;
    const [key] = Object.keys(n);
    const args = n[key];
    const value = Array.isArray(args) ? parse(args.find((a) => typeof a === "string")) : null;
    if (!value) return null;
    if (key === "jp_ver_ge") bounds.lower = { value, inclusive: true };
    else if (key === "jp_ver_gt") bounds.lower = { value, inclusive: false };
    else if (key === "jp_ver_le") bounds.upper = { value, inclusive: true };
    else if (key === "jp_ver_lt") bounds.upper = { value, inclusive: false };
    else return null;
  }
  return bounds.lower || bounds.upper ? bounds : null;
}

/** Do the closed range [lower, upper] and a cohort's bounds share a version? */
export function overlaps(lower: string, upper: string, other: VersionBounds): boolean {
  const lo = parse(lower);
  const hi = parse(upper);
  if (!lo || !hi) return false;
  // other.lower must not lie above the range's upper end, and other.upper must not lie below its lower end.
  if (other.lower) {
    const c = compare(other.lower.value, hi);
    if (c > 0 || (c === 0 && !other.lower.inclusive)) return false;
  }
  if (other.upper) {
    const c = compare(other.upper.value, lo);
    if (c < 0 || (c === 0 && !other.upper.inclusive)) return false;
  }
  return true;
}

export interface CohortOverlap {
  name: string;
  /** Position in the evaluation order (0 is checked first). */
  index: number;
  /** True when the new range, at the chosen priority, is checked before this cohort and so takes the shared devices. */
  takenByNewRange: boolean;
}

/**
 * Existing cohorts (in evaluation order) that share a version with the new range. `priority` is the index the new
 * range will take, so every cohort at that index or later is checked after it.
 */
export function overlappingCohorts(
  order: string[],
  definitions: Record<string, unknown>,
  lower: string,
  upper: string,
  priority: number
): CohortOverlap[] {
  const found: CohortOverlap[] = [];
  order.forEach((name, index) => {
    if (name === "otherwise") return;
    const bounds = versionBounds(definitions[name]);
    if (bounds && overlaps(lower, upper, bounds)) found.push({ name, index, takenByNewRange: index >= priority });
  });
  return found;
}
