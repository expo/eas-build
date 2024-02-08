import { BuildFunctionGroup } from '@expo/steps';

import { CustomBuildContext } from '../customBuildContext';

import { createEasBuildBuildFunctionGroup } from './functionGroups/build';

export function getEasFunctionGroups(ctx: CustomBuildContext): BuildFunctionGroup[] {
  return [createEasBuildBuildFunctionGroup(ctx)];
}
