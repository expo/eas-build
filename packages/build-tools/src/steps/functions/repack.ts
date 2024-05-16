import path from 'path';
import { promisify } from 'util';
import { Stream } from 'stream';
import assert from 'node:assert';

import { BuildFunction, BuildStepOutput } from '@expo/steps';
import fs from 'fs-extra';
import { Platform } from '@expo/eas-build-job';
import fetch from 'node-fetch';
import { repackAppAndroidAsync, repackAppIosAsync } from '@expo/repack-app';
import { v4 as uuidv4 } from 'uuid';

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
      const tmpDir = `/tmp/eas-build-golden-dev-client-app-${uuidv4()}`;
      await fs.mkdirs(tmpDir);
      stepsCtx.logger.info(`Created temporary directory: ${tmpDir}`);

      stepsCtx.logger.info('Downloading golden development client archive...');
      const fileName =
        stepsCtx.global.staticContext.job.platform === Platform.IOS
          ? 'golden-dev-client-latest.ipa'
          : 'golden-dev-client-latest.apk';
      const goldenArchiveUrl =
        env.__EAS_GOLDEN_DEV_CLIENT_URL ??
        `https://storage.googleapis.com/turtle-v2/onboarding/${fileName}`;
      const goldenArchivePath = path.join(tmpDir, fileName);
      try {
        const response = await fetch(goldenArchiveUrl, {
          timeout: 5 * 60 * 1000, // 5 minutes
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
        stepsCtx.global.staticContext.job.platform === Platform.IOS ? 'target.ipa' : 'target.apk'
      );
      if (stepsCtx.global.staticContext.job.platform === Platform.IOS) {
        assert(
          stepsCtx.global.staticContext.job.secrets?.buildCredentials,
          'iOS credentials are required'
        );
        const credentialsManager = new IosCredentialsManager(
          stepsCtx.global.staticContext.job.secrets.buildCredentials
        );
        const credentials = await credentialsManager.prepare(stepsCtx.logger);
        await repackAppIosAsync({
          platform: 'ios',
          projectRoot: stepsCtx.workingDirectory,
          sourceAppPath: goldenArchivePath,
          outputPath: repackedArchivePath,
          workingDirectory: tmpDir,
          iosSigningOptions: {
            provisioningProfile: Object.values(credentials.targetProvisioningProfiles)[0].path,
            keychainPath: credentials.keychainPath,
            signingIdentity:
              credentials.applicationTargetProvisioningProfile.data.certificateCommonName,
          },
          logger: stepsCtx.logger,
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
          androidSigningOptions: androidCredentials
            ? {
                keyStorePath: androidCredentials?.keyStorePath,
                keyStorePassword: androidCredentials?.keyStorePassword,
                keyAlias: androidCredentials?.keyAlias,
                keyPassword: androidCredentials?.keyPassword,
              }
            : undefined,
          logger: stepsCtx.logger,
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
