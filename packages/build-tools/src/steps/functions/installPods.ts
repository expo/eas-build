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
        logger: stepsCtx.logger,
        env: {
          ...env,
          LANG: 'en_US.UTF-8',
        },
        cwd: stepsCtx.workingDirectory,
        lineTransformer: (line?: string) => {
          if (
            !line ||
            /\[!\] '[\w-]+' uses the unencrypted 'http' protocol to transfer the Pod\./.exec(line)
          ) {
            return null;
          } else {
            return line;
          }
        },
      });
    },
  });
}
