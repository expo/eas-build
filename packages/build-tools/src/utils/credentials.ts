import path from 'path';

import { Android, Ios } from '@expo/eas-build-job';
import { bunyan } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs-extra';

import { BuildContext } from '../context';
import { IosCredentials, getIosCredentialsManager } from '../ios/credentials/manager';

// keep in sync with EasContext.credentials.android in @expo/steps package
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
  const credentials = {
    keystore: {
      keystorePath,
      keystorePassword: buildCredentials.keystore.keystorePassword,
      keyAlias: buildCredentials.keystore.keyAlias,
      keyPassword: buildCredentials.keystore.keyPassword,
    },
  };
  return credentials;
}

export async function prepareIosCredentials(
  ctx: BuildContext<Ios.Job>,
  logger: bunyan
): Promise<IosCredentials | null> {
  const credentialsManager = getIosCredentialsManager();
  return await credentialsManager.prepare(ctx, logger);
}

export async function cleanUpIosCredentials(logger: bunyan): Promise<void> {
  await getIosCredentialsManager().cleanUp(logger);
}
