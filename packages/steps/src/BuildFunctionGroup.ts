import { BuildFunctionCallInputs } from './BuildFunction.js';
import { BuildStep } from './BuildStep.js';
import { BuildStepGlobalContext } from './BuildStepContext.js';
import {
  BuildStepInputById,
  BuildStepInputProvider,
  makeBuildStepInputByIdMap,
} from './BuildStepInput.js';
import { BuildConfigError } from './errors.js';

export type BuildFunctionGroupById = Record<string, BuildFunctionGroup | undefined>;

export class BuildFunctionGroup {
  public readonly namespace: string;
  public readonly id: string;
  public readonly inputProviders?: BuildStepInputProvider[];
  public readonly createBuildStepsFromFunctionGroupCallAsync: (
    globalCtx: BuildStepGlobalContext,
    options?: {
      callInputs?: BuildFunctionCallInputs;
    }
  ) => Promise<BuildStep[]>;

  constructor({
    namespace,
    id,
    inputProviders,
    createBuildStepsFromFunctionGroupCallAsync,
  }: {
    namespace: string;
    id: string;
    inputProviders?: BuildStepInputProvider[];
    createBuildStepsFromFunctionGroupCallAsync: (
      globalCtx: BuildStepGlobalContext,
      {
        inputs,
      }: {
        inputs: BuildStepInputById;
      }
    ) => Promise<BuildStep[]>;
  }) {
    this.namespace = namespace;
    this.id = id;
    this.inputProviders = inputProviders;

    this.createBuildStepsFromFunctionGroupCallAsync = async (ctx, { callInputs = {} } = {}) => {
      const inputs = this.inputProviders?.map((inputProvider) => {
        const input = inputProvider(ctx, id);
        if (input.id in callInputs) {
          input.set(callInputs[input.id]);
        }
        return input;
      });
      return await createBuildStepsFromFunctionGroupCallAsync(ctx, {
        inputs: makeBuildStepInputByIdMap(inputs),
      });
    };
  }

  public getFullId(): string {
    return this.namespace === undefined ? this.id : `${this.namespace}/${this.id}`;
  }
}

export function createBuildFunctionGroupByIdMapping(
  buildFunctionGroups: BuildFunctionGroup[]
): BuildFunctionGroupById {
  const buildFunctionGroupById: BuildFunctionGroupById = {};
  for (const buildFunctionGroup of buildFunctionGroups) {
    if (buildFunctionGroupById[buildFunctionGroup.getFullId()] !== undefined) {
      throw new BuildConfigError(
        `Build function group with id ${buildFunctionGroup.getFullId()} is already defined.`
      );
    }
    buildFunctionGroupById[buildFunctionGroup.getFullId()] = buildFunctionGroup;
  }
  return buildFunctionGroupById;
}
