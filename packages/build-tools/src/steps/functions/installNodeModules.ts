import { Job } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { BuildContext } from '../../context';
import { installDependenciesAsync } from '../../common/installDependencies';

export function createInstallNodeModulesBuildFunction<T extends Job>(
  ctx: BuildContext<T>
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'install_node_modules',
    name: 'Install node modules',
    fn: async (stepsCtx) => {
      await installDependenciesAsync(ctx, {
        logger: stepsCtx.logger,
        workingDir: stepsCtx.workingDirectory,
      });
    },
  });
}
