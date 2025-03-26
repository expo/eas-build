import { BuildFunctionGroup } from '@expo/steps';

import { CustomBuildContext } from '../customBuildContext';

import { createEasBuildBuildFunctionGroup } from './functionGroups/build';
import { createEasMaestroTestFunctionGroup } from './functionGroups/maestroTest';
import { createEasSubmitBuildFunctionGroup } from './functionGroups/submit';

export function getEasFunctionGroups(ctx: CustomBuildContext): BuildFunctionGroup[] {
  const functionGroups = [
    createEasMaestroTestFunctionGroup(ctx),
    createEasSubmitBuildFunctionGroup(ctx),
  ];

  if (ctx.hasBuildJob()) {
    functionGroups.push(...[createEasBuildBuildFunctionGroup(ctx)]);
  }

  return functionGroups;
}
