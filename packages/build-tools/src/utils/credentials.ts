import path from 'path';

import { Android, Ios } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';

import { BuildContext } from '../context';
import { getIosCredentialsManager } from '../ios/credentials/manager';

export interface AndroidCredentials {
  keystore: {
    keystorePath: string;
    keystorePassword: string;
    keyAlias: string;
    keyPassword?: string;
  };
}

export async function prepareAndroidCredentials(
  ctx: BuildContext<Android.Job>,
  logger: bunyan
): Promise<AndroidCredentials> {
  const { buildCredentials } = ctx.job.secrets;

  if (!buildCredentials) {
    // TODO: sentry (should be detected earlier)
    throw new Error('secrets are missing in the job object');
  }
  logger.info("Restoring project's secrets");
  const keystorePath = path.join(ctx.buildDirectory, `keystore-${uuidv4()}`);
  await fs.writeFile(keystorePath, Buffer.from(buildCredentials.keystore.dataBase64, 'base64'));
  const credentialsJson = {
    keystore: {
      keystorePath,
      keystorePassword: buildCredentials.keystore.keystorePassword,
      keyAlias: buildCredentials.keystore.keyAlias,
      keyPassword: buildCredentials.keystore.keyPassword,
    },
  };
  return credentialsJson;
}

export async function prepareIosCredentials(
  ctx: BuildContext<Ios.Job>,
  logger: bunyan
): Promise<void> {
  const credentialsManager = getIosCredentialsManager();
  ctx.credentials = await credentialsManager.prepare(ctx, logger);
}

export async function cleanUpIosCredentials(
  ctx: BuildContext<Ios.Job>,
  logger: bunyan
): Promise<void> {
  if (ctx.credentials) {
    logger.info('Cleaning up iOS credentials');
    await getIosCredentialsManager().cleanUp();
  } else {
    logger.info('Nothing to clean up');
  }
}
