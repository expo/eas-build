import { BuildPhase, Job } from '@expo/eas-build-job';

import { BuildContext } from '../context';
import { Hook, runHookIfPresent } from '../utils/hooks';

export async function runBuilderWithHooksAsync<T extends Job>(
  ctx: BuildContext<T>,
  builder: (ctx: BuildContext<T>) => Promise<string>
): Promise<string> {
  let buildSuccess = true;
  try {
    const archiveLocation = await builder(ctx);
    await ctx.runBuildPhase(BuildPhase.ON_BUILD_SUCCESS_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.ON_BUILD_SUCCESS);
    });
    return archiveLocation;
  } catch (err: any) {
    buildSuccess = false;
    await ctx.runBuildPhase(BuildPhase.ON_BUILD_ERROR_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.ON_BUILD_ERROR);
    });
    throw err;
  } finally {
    await ctx.runBuildPhase(BuildPhase.ON_BUILD_COMPLETE_HOOK, async () => {
      await runHookIfPresent(ctx, Hook.ON_BUILD_COMPLETE, {
        extraEnvs: {
          EAS_BUILD_STATUS: buildSuccess ? 'finished' : 'errored',
        },
      });
    });
  }
}
