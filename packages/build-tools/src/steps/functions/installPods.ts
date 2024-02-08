import { BuildFunction } from '@expo/steps';
import spawn from '@expo/turtle-spawn';

export function createInstallPodsBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'install_pods',
    name: 'Install Pods',
    fn: async (stepsCtx, { env }) => {
      stepsCtx.logger.info('Installing pods');
      await spawn('pod', ['install'], {
        stdio: 'pipe',
        env,
        cwd: stepsCtx.workingDirectory,
      });
    },
  });
}
