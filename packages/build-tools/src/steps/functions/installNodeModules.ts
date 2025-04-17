import path from 'path';

import { BuildFunction, BuildStepEnv } from '@expo/steps';
import { BuildStepContext } from '@expo/steps/dist_esm/BuildStepContext';
import spawn from '@expo/turtle-spawn';

import {
  findPackagerRootDir,
  PackageManager,
  resolvePackageManager,
} from '../../utils/packageManager';
import { isUsingYarn2 } from '../../utils/project';

export function createInstallNodeModulesBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'install_node_modules',
    name: 'Install node modules',
    fn: async (stepCtx, { env }) => {
      await installNodeModules(stepCtx, env);
    },
  });
}

export async function installNodeModules(
  stepCtx: BuildStepContext,
  env: BuildStepEnv
): Promise<void> {
  const { logger } = stepCtx;
  const packageManager = resolvePackageManager(stepCtx.workingDirectory);
  const packagerRunDir = findPackagerRootDir(stepCtx.workingDirectory);

  if (packagerRunDir !== stepCtx.workingDirectory) {
    const relativeReactNativeProjectDirectory = path.relative(
      stepCtx.global.projectTargetDirectory,
      stepCtx.workingDirectory
    );
    logger.info(
      `We detected that '${relativeReactNativeProjectDirectory}' is a ${packageManager} workspace`
    );
  }

  let args = ['install'];
  if (packageManager === PackageManager.PNPM) {
    args = ['install', '--no-frozen-lockfile'];
  } else if (packageManager === PackageManager.YARN) {
    const isYarn2 = await isUsingYarn2(stepCtx.workingDirectory);
    if (isYarn2) {
      args = ['install', '--no-immutable', '--inline-builds'];
    }
  }

  if (env['EAS_VERBOSE'] === '1') {
    args = [...args, '--verbose'];
  }

  logger.info(`Running "${packageManager} ${args.join(' ')}" in ${packagerRunDir} directory`);
  await spawn(packageManager, args, {
    cwd: packagerRunDir,
    logger: stepCtx.logger,
    env,
  });
}
