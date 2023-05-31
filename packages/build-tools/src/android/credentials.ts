import path from 'path';

import { Android } from '@expo/eas-build-job';
import fs from 'fs-extra';

import { BuildContext } from '../context';
import { prepareAndroidCredentials } from '../utils/credentials';

async function restoreCredentials(ctx: BuildContext<Android.Job>): Promise<void> {
  const androidCredentials = await prepareAndroidCredentials(ctx, ctx.logger);
  const credentialsJson = {
    android: androidCredentials,
  };
  await fs.writeFile(
    path.join(ctx.buildDirectory, 'credentials.json'),
    JSON.stringify(credentialsJson)
  );
}

export { restoreCredentials };
