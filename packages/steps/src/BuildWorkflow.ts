import { BuildArtifacts, BuildArtifactType } from './BuildArtifacts.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepContext } from './BuildStepContext.js';
import { BuildStepEnv } from './BuildStepEnv.js';
import {
  cleanUpWorkflowTemporaryDirectoriesAsync,
  findArtifactsByTypeAsync,
} from './BuildTemporaryFiles.js';

export class BuildWorkflow {
  public readonly buildSteps: BuildStep[];

  constructor(private readonly ctx: BuildStepContext, { buildSteps }: { buildSteps: BuildStep[] }) {
    this.buildSteps = buildSteps;
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
      [BuildArtifactType.APPLICATION_ARCHIVE]: applicationArchives,
      [BuildArtifactType.BUILD_ARTIFACT]: buildArtifacts,
    };
  }

  public async cleanUpAsync(): Promise<void> {
    await cleanUpWorkflowTemporaryDirectoriesAsync(this.ctx);
  }
}
