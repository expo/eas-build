import { Job } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';

import { BuildContext } from '../context';

import { PackageManager } from './packageManager';
import { isUsingYarn2 } from './project';

export enum Hook {
  PRE_INSTALL = 'eas-build-pre-install',
  POST_INSTALL = 'eas-build-post-install',
  PRE_UPLOAD_ARTIFACTS = 'eas-build-pre-upload-artifacts',
}

export async function runHookIfPresent<TJob extends Job>(
  ctx: BuildContext<TJob>,
  hook: Hook
): Promise<void> {
  const projectDir = ctx.reactNativeProjectDirectory;
  if (ctx.packageJson.scripts?.[hook]) {
    ctx.logger.info(`Script '${hook}' is present in package.json, running it...`);
    // when using yarn 2, it's not possible to run any scripts before running 'yarn install'
    // use 'npm' in that case
    const packageManager =
      (await isUsingYarn2(projectDir)) && hook === Hook.PRE_INSTALL
        ? PackageManager.NPM
        : ctx.packageManager;
    await spawn(packageManager, ['run', hook], {
      cwd: projectDir,
      logger: ctx.logger,
      env: ctx.env,
    });
  }
}
