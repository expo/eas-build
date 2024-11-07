import { BuildStepEnv } from '@expo/steps';
import fs from 'fs-extra';
import { bunyan } from '@expo/logger';

import {
  ExpoFingerprintCLICommandFailedError,
  ExpoFingerprintCLIInvalidCommandError,
  ExpoFingerprintCLIModuleNotFoundError,
  expoFingerprintCommandAsync,
  isModernExpoFingerprintCLISupportedAsync,
} from './expoFingerprintCli';
import { diffFingerprints } from './fingerprint';

export async function diffFingerprintsAsync(
  projectDir: string,
  fingerprint1File: string,
  fingerprint2File: string,
  { env, logger }: { env: BuildStepEnv; logger: bunyan }
): Promise<string> {
  if (!(await isModernExpoFingerprintCLISupportedAsync(projectDir))) {
    logger.debug('Falling back to local fingerprint diff');
    return await diffFingerprintsFallbackAsync(fingerprint1File, fingerprint2File);
  }

  try {
    return await diffFingerprintsCommandAsync(projectDir, fingerprint1File, fingerprint2File, {
      env,
    });
  } catch (e) {
    if (
      e instanceof ExpoFingerprintCLIModuleNotFoundError ||
      e instanceof ExpoFingerprintCLICommandFailedError ||
      e instanceof ExpoFingerprintCLIInvalidCommandError
    ) {
      logger.debug('Falling back to local fingerprint diff');
      return await diffFingerprintsFallbackAsync(fingerprint1File, fingerprint2File);
    }
    throw e;
  }
}

async function diffFingerprintsCommandAsync(
  projectDir: string,
  fingerprint1File: string,
  fingerprint2File: string,
  { env }: { env: BuildStepEnv }
): Promise<string> {
  return await expoFingerprintCommandAsync(
    projectDir,
    ['fingerprint:diff', fingerprint1File, fingerprint2File],
    {
      env,
    }
  );
}

async function diffFingerprintsFallbackAsync(
  fingerprint1File: string,
  fingerprint2File: string
): Promise<string> {
  const [fingeprint1, fingerprint2] = await Promise.all([
    fs.readJSON(fingerprint1File),
    fs.readJSON(fingerprint2File),
  ]);
  return JSON.stringify(diffFingerprints(fingeprint1, fingerprint2));
}
