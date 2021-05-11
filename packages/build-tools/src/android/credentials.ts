import path from 'path';

import { Android } from '@expo/eas-build-job';
import fs from 'fs-extra';
import { v4 as uuidv4 } from 'uuid';

import { BuildContext } from '../context';

async function restoreCredentials(ctx: BuildContext<Android.Job>): Promise<void> {
  const { buildCredentials } = ctx.job.secrets;
  if (!buildCredentials) {
    // TODO: sentry (should be detected earlier)
    throw new Error('secrets are missing in the job object');
  }
  ctx.logger.info("Writing secrets to the project's directory");
  const projectDir = ctx.reactNativeProjectDirectory;
  const keystorePath = `keystore-${uuidv4()}`;
  await fs.writeFile(
    path.join(projectDir, keystorePath),
    Buffer.from(buildCredentials.keystore.dataBase64, 'base64')
  );
  const credentialsJson = {
    android: {
      keystore: {
        keystorePath,
        keystorePassword: buildCredentials.keystore.keystorePassword,
        keyAlias: buildCredentials.keystore.keyAlias,
        keyPassword: buildCredentials.keystore.keyPassword,
      },
    },
  };
  await fs.writeFile(path.join(projectDir, 'credentials.json'), JSON.stringify(credentialsJson));
}

export { restoreCredentials };
