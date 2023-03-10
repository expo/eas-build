import { BuildArtifacts, BuildArtifactType } from './BuildArtifacts.js';
import { BuildFunctionById } from './BuildFunction.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepEnv } from './BuildStepEnv.js';
import {
  cleanUpWorkflowTemporaryDirectoriesAsync,
  findArtifactsByTypeAsync,
} from './BuildTemporaryFiles.js';

export class BuildWorkflow {
  public readonly buildSteps: BuildStep[];
  public readonly buildFunctions: BuildFunctionById;

  constructor(
    private readonly ctx: BuildStepContext,
    { buildSteps, buildFunctions }: { buildSteps: BuildStep[]; buildFunctions: BuildFunctionById }
  ) {
    this.buildSteps = buildSteps;
    this.buildFunctions = buildFunctions;
  }

  public async executeAsync(env: BuildStepEnv = process.env): Promise<void> {
    for (const step of this.buildSteps) {
      await step.executeAsync(env);
    }
  }

  public async collectArtifactsAsync(): Promise<BuildArtifacts> {
    const applicationArchives = await findArtifactsByTypeAsync(
      this.ctx,
      BuildArtifactType.APPLICATION_ARCHIVE
    );
    const buildArtifacts = await findArtifactsByTypeAsync(
      this.ctx,
      BuildArtifactType.BUILD_ARTIFACT
    );
    return {
      ...(applicationArchives.length > 0 && {
        [BuildArtifactType.APPLICATION_ARCHIVE]: applicationArchives,
      }),
      ...(buildArtifacts.length > 0 && { [BuildArtifactType.BUILD_ARTIFACT]: buildArtifacts }),
    };
  }

  public async cleanUpAsync(): Promise<void> {
    await cleanUpWorkflowTemporaryDirectoriesAsync(this.ctx);
  }
}
