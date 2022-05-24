import path from 'path';

import spawn from '@expo/turtle-spawn';
import { Android, Job } from '@expo/eas-build-job';
import fs from 'fs-extra';

import { BuildContext } from '../context';

export async function ensureLFLineEndingsInGradlewScript<TJob extends Job>(
  ctx: BuildContext<TJob>
): Promise<void> {
  const gradlewPath = path.join(ctx.reactNativeProjectDirectory, 'android', 'gradlew');
  const gradlewContent = await fs.readFile(gradlewPath, 'utf8');
  if (gradlewContent.includes('\r')) {
    ctx.logger.info('Replacing CRLF line endings with LF in gradlew script');
    await fs.writeFile(gradlewPath, gradlewContent.replace(/\r\n/g, '\n'), 'utf8');
  }
}

export async function runGradleCommand(
  ctx: BuildContext<Android.Job>,
  gradleCommand: string
): Promise<void> {
  const versionName = ctx.job.version?.versionName;
  const versionCode = ctx.job.version?.versionCode;
  const env = {
    ...ctx.env,
    ...(versionCode ? { EAS_BUILD_VERSION_CODE: versionCode } : {}),
    ...(versionName ? { EAS_BUILD_VERSION_NAME: versionName } : {}),
  };
  const androidDir = path.join(ctx.reactNativeProjectDirectory, 'android');
  ctx.logger.info(`Running './gradlew ${gradleCommand}' in ${androidDir}`);
  await spawn('sh', ['gradlew', gradleCommand], {
    cwd: androidDir,
    logger: ctx.logger,
    lineTransformer: (line?: string) => {
      if (!line || /^\.+$/.exec(line)) {
        return null;
      } else {
        return line;
      }
    },
    env,
  });
}
