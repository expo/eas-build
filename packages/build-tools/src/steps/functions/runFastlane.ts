import { BuildFunction } from '@expo/steps';

import { runFastlaneGym } from '../utils/ios/fastlane';

export function runFastlaneFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'run_fastlane',
    name: 'Run fastlane',
    fn: async (stepCtx, { env }) => {
      await runFastlaneGym({
        workingDir: stepCtx.workingDirectory,
        env: Object.keys(env).reduce(
          (acc, key) => {
            acc[key] = env[key] ?? '';
            return acc;
          },
          {} as Record<string, string>
        ),
        logger: stepCtx.logger,
        buildLogsDirectory: stepCtx.global.buildLogsDirectory,
      });
    },
  });
}
