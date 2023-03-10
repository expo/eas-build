import path from 'path';

import { BuildPhase, Job } from '@expo/eas-build-job';
import { BuildArtifactType, BuildConfigParser, BuildStepContext } from '@expo/steps';
import nullthrows from 'nullthrows';

import { Artifacts, ArtifactType, BuildContext } from '../context';
import { prepareProjectSourcesAsync } from '../common/projectSources';

export async function runCustomBuildAsync<T extends Job>(ctx: BuildContext<T>): Promise<Artifacts> {
  await prepareProjectSourcesAsync(ctx);

  const relativeConfigPath = nullthrows(
    ctx.job.customBuildConfig?.path,
    'Custom build config must be defined for custom builds'
  );
  const configPath = path.join(ctx.reactNativeProjectDirectory, relativeConfigPath);

  const buildStepContext = new BuildStepContext(
    ctx.env.EAS_BUILD_ID,
    ctx.logger.child({ phase: BuildPhase.CUSTOM }),
    false,
    ctx.reactNativeProjectDirectory
  );
  const parser = new BuildConfigParser(buildStepContext, { configPath });
  const workflow = await parser.parseAsync();
  try {
    try {
      await workflow.executeAsync(ctx.env);
    } finally {
      await ctx.runBuildPhase(BuildPhase.UPLOAD_BUILD_ARTIFACTS, async () => {
        try {
          const artifacts = await workflow.collectArtifactsAsync();
          for (const buildArtifactType of Object.keys(artifacts)) {
            const type: ArtifactType =
              buildArtifactType === BuildArtifactType.APPLICATION_ARCHIVE
                ? ArtifactType.APPLICATION_ARCHIVE
                : ArtifactType.BUILD_ARTIFACTS;
            const filePaths = artifacts[buildArtifactType as BuildArtifactType] ?? [];
            if (filePaths.length > 0) {
              await ctx.uploadArtifacts(type, filePaths);
            }
          }
        } catch (err: any) {
          ctx.logger.error({ err }, 'Failed to upload artifacts');
        }
      });

      try {
        await workflow.cleanUpAsync();
      } catch (err: any) {
        ctx.logger.error({ err }, 'Failed to clean up custom build temporary files');
      }
    }
  } catch (err: any) {
    err.artifacts = ctx.artifacts;
    throw err;
  }

  return ctx.artifacts;
}
