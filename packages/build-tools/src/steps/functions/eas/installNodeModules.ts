import { BuildFunction } from '@expo/steps';
import { BuildStepContext } from '@expo/steps/dist_esm/BuildStepContext';
import spawn from '@expo/turtle-spawn';

import { CustomBuildContext } from '../../../customBuildContext';
import {
  findPackagerRootDir,
  PackageManager,
  resolvePackageManager,
} from '../../../utils/packageManager';
import { isUsingYarn2 } from '../../../utils/project';

export function createInstallNodeModulesBuildFunction(ctx: CustomBuildContext): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'install_node_modules',
    name: 'Install node modules',
    fn: async (stepCtx) => {
      await installNodeModules(stepCtx, ctx);
    },
  });
}

export async function installNodeModules(
  stepCtx: BuildStepContext,
  ctx: CustomBuildContext
): Promise<void> {
  const { logger } = stepCtx;
  const packageManager = resolvePackageManager(ctx.projectTargetDirectory);
  const packagerRunDir = findPackagerRootDir(stepCtx.workingDirectory);
  let args = ['install'];
  if (packageManager === PackageManager.PNPM) {
    args = ['install', '--no-frozen-lockfile'];
  } else if (packageManager === PackageManager.YARN) {
    const isYarn2 = await isUsingYarn2(stepCtx.workingDirectory);
    if (isYarn2) {
      args = ['install', '--no-immutable'];
    }
  }
  logger.info(`Running "${packageManager} ${args.join(' ')}" in ${packagerRunDir} directory`);
  await spawn(packageManager, args, {
    cwd: packagerRunDir,
    logger: stepCtx.logger,
    env: ctx.env,
  });
}
