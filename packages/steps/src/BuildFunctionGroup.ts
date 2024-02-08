import { BuildStep } from './BuildStep.js';
import { BuildStepGlobalContext } from './BuildStepContext.js';
import { BuildConfigError } from './errors.js';

export type BuildFunctionGroupById = Record<string, BuildFunctionGroup | undefined>;

export class BuildFunctionGroup {
  public readonly namespace: string;
  public readonly id: string;
  public readonly createBuildStepsFromFunctionGroupCall: (
    globalCtx: BuildStepGlobalContext
  ) => BuildStep[];

  constructor({
    namespace,
    id,
    createBuildStepsFromFunctionGroupCall,
  }: {
    namespace: string;
    id: string;
    createBuildStepsFromFunctionGroupCall: (globalCtx: BuildStepGlobalContext) => BuildStep[];
  }) {
    this.namespace = namespace;
    this.id = id;
    this.createBuildStepsFromFunctionGroupCall = createBuildStepsFromFunctionGroupCall;
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
