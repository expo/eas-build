import { BuildJob, Env } from '@expo/eas-build-job';

import { runExpoCliCommand } from '../utils/project';
import { BuildContext } from '../context';

export async function eagerBundleAsync<TJob extends BuildJob>(
  ctx: BuildContext<TJob>,
  options?: { extraEnv?: Env }
): Promise<void> {
  await runExpoCliCommand(ctx, ['export:embed', '--eager', '--platform', ctx.job.platform], {
    cwd: ctx.getReactNativeProjectDirectory(),
    logger: ctx.logger,
    env: {
      ...ctx.env,
      ...options?.extraEnv,
    },
  });
}
