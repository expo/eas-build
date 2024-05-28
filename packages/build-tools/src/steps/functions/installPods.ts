import { BuildFunction, spawnAsync } from '@expo/steps';

export function createInstallPodsBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'install_pods',
    name: 'Install Pods',
    fn: async (stepsCtx, { env }) => {
      stepsCtx.logger.info('Installing pods');
      await spawnAsync('pod', ['install'], {
        stdio: 'pipe',
        env,
        logger: stepsCtx.logger,
        cwd: stepsCtx.workingDirectory,
      });
    },
  });
}
