import type { BigIntStats, Dirent, Stats } from 'node:fs';
import * as path from 'node:path';

const WINDOWS_METADATA_NAME = /^(?:thumbs\.db|desktop\.ini)$/i;

/** Archive payload policy only; ephemera and Git facts have separate contracts. */
export function isArchiveOsMetadataName(name: string): boolean {
  return name === '.DS_Store' || WINDOWS_METADATA_NAME.test(name);
}

/**
 * Ignore only an observed regular file, never a same-name directory or symlink.
 * Content/timestamp churn is immaterial, but an object/type replacement during
 * classification is not. A vanished regular metadata file needs no authority.
 */
export async function isExcludedArchiveOsMetadata(
  directory: string,
  entry: Dirent,
  fileSystem: { lstat(target: string): Promise<Stats | BigIntStats> }
): Promise<boolean> {
  if (
    !isArchiveOsMetadataName(entry.name) ||
    !entry.isFile() ||
    entry.isSymbolicLink()
  ) {
    return false;
  }
  const target = path.join(directory, entry.name);
  let before: Stats | BigIntStats;
  let after: Stats | BigIntStats;
  try {
    before = await fileSystem.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
  if (!before.isFile() || before.isSymbolicLink()) {
    throw Object.assign(
      new Error(`Archive OS metadata changed type before classification: ${target}`),
      { code: 'ESTALE' }
    );
  }
  try {
    after = await fileSystem.lstat(target);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
  if (
    !after.isFile() ||
    after.isSymbolicLink() ||
    String(before.dev) !== String(after.dev) ||
    String(before.ino) !== String(after.ino) ||
    String(before.mode) !== String(after.mode)
  ) {
    throw Object.assign(
      new Error(`Archive OS metadata changed object or type during classification: ${target}`),
      { code: 'ESTALE' }
    );
  }
  return true;
}
