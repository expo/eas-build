import { BuildTrigger } from '@expo/eas-build-job';
import { BuildFunction } from '@expo/steps';

import { runEasBuildInternalAsync } from '../../common/easBuildInternal';
import { CustomBuildContext } from '../../customBuildContext';

export function createGetCredentialsForBuildTriggeredByGithubIntegration(
  ctx: CustomBuildContext
): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'get_credentials_for_build_triggered_by_github_integration',
    name: 'Get credentials for build triggered by GitHub integration',
    fn: async (stepCtx, { env }) => {
      if (ctx.job.triggeredBy === BuildTrigger.GIT_BASED_INTEGRATION) {
        stepCtx.logger.info('Getting credentials for build triggered by EAS GitHub integration...');
        const { newJob, newMetadata } = await runEasBuildInternalAsync({
          job: ctx.job,
          env,
          logger: stepCtx.logger,
          cwd: stepCtx.workingDirectory,
        });
        ctx.updateJobInformation(newJob, newMetadata);
        stepCtx.logger.info('Credentials obtained.');
      } else {
        stepCtx.logger.info('Not a build triggered by EAS GitHub integration. Skipping...');
      }
    },
  });
}
