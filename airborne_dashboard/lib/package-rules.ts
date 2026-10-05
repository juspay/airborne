import type { FileSet, FileSetMember, SelectedFile, SelectedFileSet } from "@/types/files";

// Package rules for building a package from file sets and individual files.
// The server enforces the same rules in `plan_package_files`
// (airborne_server/src/package.rs); these only give early, friendlier errors.

/** Paths provided by the chosen sets: path -> the version and the set it comes from. */
export function coveredBySets(sets: SelectedFileSet[]): Map<string, { version: number; set: string }> {
  const covered = new Map<string, { version: number; set: string }>();
  for (const set of sets) {
    for (const f of set.files) {
      if (!covered.has(f.file_path)) covered.set(f.file_path, { version: f.version, set: set.name });
    }
  }
  return covered;
}

/**
 * Why `fileSet` can't join the package, or undefined if it can. The index file
 * can't also come from a set, and a package holds one version per path; the
 * identical file version from two sources is fine (it is included once).
 */
export function setConflict(
  fileSet: FileSet,
  files: FileSetMember[],
  ctx: { indexPath?: string; sets: SelectedFileSet[]; individual: SelectedFile[] }
): string | undefined {
  const indexFile = files.find((f) => f.file_path === ctx.indexPath);
  if (indexFile) {
    return `It contains ${indexFile.file_path}, which is this package's index file. Pick a different index file or set.`;
  }
  const covered = coveredBySets(ctx.sets);
  for (const f of files) {
    const fromSet = covered.get(f.file_path);
    const individual = ctx.individual.find((s) => s.file_path === f.file_path);
    const other = fromSet
      ? { version: fromSet.version, source: `file set "${fromSet.set}"`, verb: "includes" }
      : individual
        ? { version: individual.version, source: "your individually selected files", verb: "include" }
        : undefined;
    if (other && other.version !== f.version) {
      return `It includes ${f.file_path}@v${f.version}, but ${other.source} already ${other.verb} v${other.version}. A package can contain only one version of a file.`;
    }
  }
  return undefined;
}

/** Why a path can't be picked individually: a chosen set already provides it. */
export function lockedBySetReason(
  filePath: string,
  covered: Map<string, { version: number; set: string }>
): string | undefined {
  const coveredBy = covered.get(filePath);
  if (!coveredBy) return undefined;
  return `The selected set "${coveredBy.set}" includes ${filePath}@v${coveredBy.version}. A package can contain only one version of a file; uncheck the set to pick it yourself.`;
}
