import { BuildFunctionGroup } from '@expo/steps';

import { CustomBuildContext } from '../customBuildContext';

import { createEasBuildBuildFunctionGroup } from './functionGroups/build';
import { createEasMaestroTestFunctionGroup } from './functionGroups/maestroTest';

export function getEasFunctionGroups(ctx: CustomBuildContext): BuildFunctionGroup[] {
  return [createEasBuildBuildFunctionGroup(ctx), createEasMaestroTestFunctionGroup(ctx)];
}
