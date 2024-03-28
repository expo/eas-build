import { BuildJob } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';

import { BuildContext } from '../context';

import { PackageManager } from './packageManager';
import { isUsingYarn2, readPackageJson } from './project';

export enum Hook {
  PRE_INSTALL = 'eas-build-pre-install',
  POST_INSTALL = 'eas-build-post-install',
  /**
   * @deprecated
   */
  PRE_UPLOAD_ARTIFACTS = 'eas-build-pre-upload-artifacts',
  ON_BUILD_SUCCESS = 'eas-build-on-success',
  ON_BUILD_ERROR = 'eas-build-on-error',
  ON_BUILD_COMPLETE = 'eas-build-on-complete',
  ON_BUILD_CANCEL = 'eas-build-on-cancel',
}

export async function runHookIfPresent<TJob extends BuildJob>(
  ctx: BuildContext<TJob>,
  hook: Hook,
  { extraEnvs }: { extraEnvs?: Record<string, string> } = {}
): Promise<void> {
  const projectDir = ctx.getReactNativeProjectDirectory();
  const packageJson = readPackageJson(projectDir);
  if (packageJson.scripts?.[hook]) {
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
      env: {
        ...ctx.env,
        ...extraEnvs,
      },
    });
  }
}
