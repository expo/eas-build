import path from 'path';
import { promisify } from 'util';
import { Stream } from 'stream';
import os from 'os';
import assert from 'assert';

import { BuildFunction, BuildStepOutput } from '@expo/steps';
import fs from 'fs-extra';
import { Platform } from '@expo/eas-build-job';
import fetch from 'node-fetch';
import { repackAppAndroidAsync, repackAppIosAsync } from '@expo/repack-app';
import { v4 as uuidv4 } from 'uuid';
import { BuildCredentials } from '@expo/eas-build-job/dist/ios';
import { bunyan } from '@expo/logger';

import IosCredentialsManager from '../utils/ios/credentials/manager';

const pipeline = promisify(Stream.pipeline);

/**
 * This function is legacy repacking for internal onboarding workflows.
 */
export function createLegacyRepackBuildFunction(): BuildFunction {
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
      const workingDirectory = path.join(tmpDir, 'working-directory');
      await fs.mkdirs(workingDirectory);
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
          workingDirectory,
          iosSigningOptions: stepsCtx.global.staticContext.job.simulator
            ? undefined
            : await resolveIosSigningOptions({
                logger: stepsCtx.logger,
                buildCredentials: stepsCtx.global.staticContext.job.secrets?.buildCredentials,
              }),
          logger: stepsCtx.logger,
          verbose: env.__EAS_REPACK_VERBOSE !== undefined,
          env: {
            FASTLANE_DISABLE_COLORS: '1',
            FASTLANE_SKIP_UPDATE_CHECK: '1',
            SKIP_SLOW_FASTLANE_WARNING: 'true',
            FASTLANE_HIDE_TIMESTAMP: 'true',
            LC_ALL: 'en_US.UTF-8',
            ...env,
          },
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
            keyStorePassword: `pass:${stepsCtx.global.staticContext.job.secrets.buildCredentials.keystore.keystorePassword}`,
            keyAlias: stepsCtx.global.staticContext.job.secrets.buildCredentials.keystore.keyAlias,
            keyPassword: stepsCtx.global.staticContext.job.secrets.buildCredentials.keystore
              .keyPassword
              ? `pass:${stepsCtx.global.staticContext.job.secrets.buildCredentials.keystore.keyPassword}`
              : undefined,
          };
        }

        await repackAppAndroidAsync({
          platform: 'android',
          projectRoot: stepsCtx.workingDirectory,
          sourceAppPath: goldenArchivePath,
          outputPath: repackedArchivePath,
          workingDirectory,
          androidSigningOptions: androidCredentials,
          logger: stepsCtx.logger,
          verbose: env.__EAS_REPACK_VERBOSE !== undefined,
          env,
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
