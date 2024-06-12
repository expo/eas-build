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

export function diffFingerprints(
  fingerprint1: Fingerprint,
  fingerprint2: Fingerprint
): FingerprintSource[] {
  return fingerprint2.sources.filter((newItem) => {
    return !fingerprint1.sources.find(
      (item) => item.type === newItem.type && item.hash === newItem.hash
    );
  });
}
