export type FingerprintSource = HashSource & {
  /**
   * Hash value of the `source`.
   * If the source is excluding by `Options.dirExcludes`, the value will be null.
   */
  hash: string | null;
  /**
   * Debug info from the hashing process. Differs based on source type. Designed to be consumed by humans
   * as opposed to programmatically.
   */
  debugInfo?: DebugInfo;
};

export interface Fingerprint {
  /**
   * Sources and their hash values to generate a fingerprint
   */
  sources: FingerprintSource[];

  /**
   * The final hash value of the whole fingerprint
   */
  hash: string;
}

export interface HashSourceFile {
  type: 'file';
  filePath: string;

  /**
   * Reasons of this source coming from
   */
  reasons: string[];
}

export interface HashSourceDir {
  type: 'dir';
  filePath: string;

  /**
   * Reasons of this source coming from
   */
  reasons: string[];
}

export interface HashSourceContents {
  type: 'contents';
  id: string;
  contents: string | Buffer;

  /**
   * Reasons of this source coming from
   */
  reasons: string[];
}

export type HashSource = HashSourceFile | HashSourceDir | HashSourceContents;

export interface DebugInfoFile {
  path: string;
  hash: string;
}

export interface DebugInfoDir {
  path: string;
  hash: string;
  children: (DebugInfoFile | DebugInfoDir | undefined)[];
}

export interface DebugInfoContents {
  hash: string;
}

export type DebugInfo = DebugInfoFile | DebugInfoDir | DebugInfoContents;

export interface FingerprintDiffItem {
  /**
   * The operation type of the diff item.
   */
  op: 'added' | 'removed' | 'changed';

  /**
   * The source of the diff item.
   *   - When type is 'added', the source is the new source.
   *   - When type is 'removed', the source is the old source.
   *   - When type is 'changed', the source is the new source.
   */
  source: FingerprintSource;
}

const typeOrder = {
  file: 0,
  dir: 1,
  contents: 2,
};

/**
 * Comparator between two sources.
 * This is useful for sorting sources in a consistent order.
 * @returns:
 *  == 0 if a and b are equal,
 *  < 0 if a is less than b,
 *  > 0 if a is greater than b.
 */
export function compareSource(a: HashSource, b: HashSource): number {
  const typeResult = typeOrder[a.type] - typeOrder[b.type];
  if (typeResult === 0) {
    if (a.type === 'file' && b.type === 'file') {
      return a.filePath.localeCompare(b.filePath);
    } else if (a.type === 'dir' && b.type === 'dir') {
      return a.filePath.localeCompare(b.filePath);
    } else if (a.type === 'contents' && b.type === 'contents') {
      return a.id.localeCompare(b.id);
    }
  }
  return typeResult;
}

export function diffFingerprints(
  fingerprint1: Fingerprint,
  fingerprint2: Fingerprint
): FingerprintDiffItem[] {
  let index1 = 0;
  let index2 = 0;
  const diff: FingerprintDiffItem[] = [];

  while (index1 < fingerprint1.sources.length && index2 < fingerprint2.sources.length) {
    const source1 = fingerprint1.sources[index1];
    const source2 = fingerprint2.sources[index2];

    const compareResult = compareSource(source1, source2);
    if (compareResult === 0) {
      if (source1.hash !== source2.hash) {
        diff.push({ op: 'changed', source: source2 });
      }
      ++index1;
      ++index2;
    } else if (compareResult < 0) {
      diff.push({ op: 'removed', source: source1 });
      ++index1;
    } else {
      diff.push({ op: 'added', source: source2 });
      ++index2;
    }
  }

  while (index1 < fingerprint1.sources.length) {
    diff.push({ op: 'removed', source: fingerprint1.sources[index1] });
    ++index1;
  }
  while (index2 < fingerprint2.sources.length) {
    diff.push({ op: 'added', source: fingerprint2.sources[index2] });
    ++index2;
  }

  return diff;
}

export function stringifyFingerprintDiff(fingerprintDiff: FingerprintDiffItem[]): string {
  return JSON.stringify(
    fingerprintDiff,
    (key, value) => {
      if (key === 'contents') {
        try {
          const item = JSON.parse(value);
          return item;
        } catch {
          return value;
        }
      }
      return value;
    },
    ' '
  );
}
