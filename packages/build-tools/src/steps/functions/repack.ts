import path from 'path';
import { promisify } from 'util';
import { Stream } from 'stream';
import os from 'os';
import assert from 'assert';

import { BuildFunction, BuildStepOutput, spawnAsync } from '@expo/steps';
import fs from 'fs-extra';
import { Platform } from '@expo/eas-build-job';
import fetch from 'node-fetch';
import {
  repackAppAndroidAsync,
  repackAppIosAsync,
  type Logger,
  type SpawnProcessAsync,
  type SpawnProcessOptions,
  type SpawnProcessPromise,
  type SpawnProcessResult,
} from '@expo/repack-app';
import { v4 as uuidv4 } from 'uuid';
import { BuildCredentials } from '@expo/eas-build-job/dist/ios';
import { bunyan } from '@expo/logger';

import IosCredentialsManager from '../utils/ios/credentials/manager';

const pipeline = promisify(Stream.pipeline);

export function createRepackBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: '__download_and_repack_golden_development_client_archive',
    name: 'Download and repack golden development client archive',
    outputProviders: [
      BuildStepOutput.createProvider({
        id: 'repacked_archive_path',
        required: true,
      }),
    ],
    fn: async (stepsCtx, { outputs, env }) => {
      const tmpDir = path.join(os.tmpdir(), `eas-build-golden-dev-client-app-${uuidv4()}`);
      await fs.mkdirs(tmpDir);
      stepsCtx.logger.info(`Created temporary directory: ${tmpDir}`);

      stepsCtx.logger.info('Downloading golden development client archive...');
      const fileName =
        stepsCtx.global.staticContext.job.platform === Platform.IOS
          ? stepsCtx.global.staticContext.job.simulator
            ? 'golden-dev-client-simulator-latest.ipa'
            : 'golden-dev-client-device-latest.ipa'
          : 'golden-dev-client-latest.apk';
      const goldenArchiveUrl =
        env.__EAS_GOLDEN_DEV_CLIENT_URL ??
        `https://storage.googleapis.com/turtle-v2/onboarding/${fileName}`;
      const goldenArchivePath = path.join(tmpDir, fileName);
      try {
        const response = await fetch(goldenArchiveUrl, {
          timeout: 1 * 60 * 1000, // 1 minute
        });
        if (!response.ok) {
          throw new Error(`[${response.status}] ${response.statusText}`);
        }
        await pipeline(response.body, fs.createWriteStream(goldenArchivePath));
      } catch (error: any) {
        throw new Error(`Failed to download golden development client archive: ${error.message}`);
      }
      stepsCtx.logger.info(`Downloaded golden development client archive to ${goldenArchivePath}`);

      stepsCtx.logger.info('Repacking and resigning the app...');
      const repackedArchivePath = path.join(
        tmpDir,
        stepsCtx.global.staticContext.job.platform === Platform.IOS
          ? stepsCtx.global.staticContext.job.simulator
            ? 'target.zip'
            : 'target.ipa'
          : 'target.apk'
      );
      if (stepsCtx.global.staticContext.job.platform === Platform.IOS) {
        await repackAppIosAsync({
          platform: 'ios',
          projectRoot: stepsCtx.workingDirectory,
          sourceAppPath: goldenArchivePath,
          outputPath: repackedArchivePath,
          workingDirectory: tmpDir,
          iosSigningOptions: stepsCtx.global.staticContext.job.simulator
            ? undefined
            : await resolveIosSigningOptions({
                logger: stepsCtx.logger,
                buildCredentials: stepsCtx.global.staticContext.job.secrets?.buildCredentials,
              }),
          logger: new LoggerAdapter(stepsCtx.logger),
          spawnAsync: createSpawnAsync(env.__EAS_REPACK_VERBOSE !== undefined, stepsCtx.logger, {
            FASTLANE_DISABLE_COLORS: '1',
            FASTLANE_SKIP_UPDATE_CHECK: '1',
            SKIP_SLOW_FASTLANE_WARNING: 'true',
            FASTLANE_HIDE_TIMESTAMP: 'true',
            LC_ALL: 'en_US.UTF-8',
            ...env,
          }),
          skipWorkingDirCleanup: true,
          verbose: env.__EAS_REPACK_VERBOSE !== undefined,
        });
      } else if (stepsCtx.global.staticContext.job.platform === Platform.ANDROID) {
        let androidCredentials:
          | {
              keyStorePath: string;
              keyStorePassword: string;
              keyAlias: string;
              keyPassword: string | undefined;
            }
          | undefined;
        if (stepsCtx.global.staticContext.job.secrets?.buildCredentials?.keystore.dataBase64) {
          const keyStorePath = path.join(tmpDir, `keystore-${uuidv4()}`);
          await fs.writeFile(
            keyStorePath,
            Buffer.from(
              stepsCtx.global.staticContext.job.secrets.buildCredentials.keystore.dataBase64,
              'base64'
            )
          );
          androidCredentials = {
            keyStorePath,
            keyStorePassword:
              stepsCtx.global.staticContext.job.secrets.buildCredentials.keystore.keystorePassword,
            keyAlias: stepsCtx.global.staticContext.job.secrets.buildCredentials.keystore.keyAlias,
            keyPassword:
              stepsCtx.global.staticContext.job.secrets.buildCredentials.keystore.keyPassword,
          };
        }

        await repackAppAndroidAsync({
          platform: 'android',
          projectRoot: stepsCtx.workingDirectory,
          sourceAppPath: goldenArchivePath,
          outputPath: repackedArchivePath,
          workingDirectory: tmpDir,
          androidSigningOptions: androidCredentials,
          logger: new LoggerAdapter(stepsCtx.logger),
          spawnAsync: createSpawnAsync(
            env.__EAS_REPACK_VERBOSE !== undefined,
            stepsCtx.logger,
            env
          ),
          skipWorkingDirCleanup: true,
          verbose: env.__EAS_REPACK_VERBOSE !== undefined,
        });
      } else {
        throw new Error('Unsupported platform');
      }

      if (!(await fs.exists(repackedArchivePath))) {
        throw new Error(`Failed to repack the app. ${repackedArchivePath} does not exist`);
      }

      stepsCtx.logger.info(`Repacked and resigned the app to ${repackedArchivePath}`);
      outputs.repacked_archive_path.set(repackedArchivePath);
    },
  });
}

async function resolveIosSigningOptions({
  buildCredentials,
  logger,
}: {
  buildCredentials: BuildCredentials | undefined;
  logger: bunyan;
}): Promise<{
  provisioningProfile: string;
  keychainPath: string;
  signingIdentity: string;
}> {
  assert(buildCredentials, 'buildCredentials is required for repacking non-simulator iOS apps');

  const credentialsManager = new IosCredentialsManager(buildCredentials);
  const credentials = await credentialsManager.prepare(logger);

  return {
    provisioningProfile: Object.values(credentials.targetProvisioningProfiles)[0].path,
    keychainPath: credentials.keychainPath,
    signingIdentity: credentials.applicationTargetProvisioningProfile.data.certificateCommonName,
  };
}

// #region Internals

class LoggerAdapter implements Logger {
  constructor(private readonly logger: bunyan) {}

  debug(...message: any[]): void {
    const [first, ...rest] = message;
    this.logger.debug(first, ...rest);
  }

  info(...message: any[]): void {
    const [first, ...rest] = message;
    this.logger.info(first, ...rest);
  }
  warn(...message: any[]): void {
    const [first, ...rest] = message;
    this.logger.warn(first, ...rest);
  }
  error(...message: any[]): void {
    const [first, ...rest] = message;
    this.logger.error(first, ...rest);
  }
  time(label: string): void {
    this.logger.info(label);
  }
  timeEnd(label: string): void {
    let endLabel;
    if (label.length === 0) {
      endLabel = label;
    } else {
      const firstChar = label.charAt(0).toLowerCase();
      const remains = label.slice(1);
      endLabel = `Finished ${firstChar}${remains} ✅`;
    }
    this.logger.info(endLabel);
  }
}

function createSpawnAsync(
  verbose: boolean,
  logger: bunyan,
  env: NodeJS.ProcessEnv = process.env
): SpawnProcessAsync {
  return function stepsSpawnAsync(
    command: string,
    args: string[],
    options?: SpawnProcessOptions
  ): SpawnProcessPromise<SpawnProcessResult> {
    const mergedEnv = options?.env ? { ...options.env, ...env } : env;
    return spawnAsync(
      command,
      args,
      verbose
        ? { ...options, env: mergedEnv, logger, stdio: 'pipe' }
        : { ...options, env: mergedEnv }
    );
  };
}

// #endregion Internals
