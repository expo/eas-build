import path from 'path';

import { BuildFunction, BuildStepEnv } from '@expo/steps';
import { BuildStepContext } from '@expo/steps/dist_esm/BuildStepContext';
import spawn from '@expo/turtle-spawn';

import {
  findPackagerRootDir,
  PackageManager,
  resolvePackageManager,
} from '../../utils/packageManager';
import { isUsingModernYarnVersion } from '../../utils/project';
import { installDependenciesAsync } from '../../common/installDependencies';

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

  const { spawnPromise } = await installDependenciesAsync({
    packageManager,
    env,
    logger: stepCtx.logger,
    cwd: packagerRunDir,
    useFrozenLockfile: doDependenciesPreventFrozenLockfile({ packageJson }),
  });
  await spawnPromise;
}
