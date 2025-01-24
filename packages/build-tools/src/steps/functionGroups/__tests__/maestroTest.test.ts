import { BuildStepGlobalContext, BuildStep } from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { createEasMaestroTestFunctionGroup, getEnvFlags } from '../maestroTest';
import { CustomBuildContext } from '../../../customBuildContext';
import { createGlobalContextMock } from '../../../__tests__/utils/context';

function createTestContext(platform: Platform): {
  globalCtx: BuildStepGlobalContext;
  buildContext: CustomBuildContext;
} {
  return {
    globalCtx: createGlobalContextMock(),
    buildContext: { job: { platform } } as CustomBuildContext,
  };
}

function getMaestroSteps(steps: BuildStep[]): BuildStep[] {
  return steps.filter((step: BuildStep) => step.name === 'maestro_test');
}

function createMaestroSteps(
  context: ReturnType<typeof createTestContext>,
  flowPath: string,
  envVars: Record<string, string>
): BuildStep[] {
  return createEasMaestroTestFunctionGroup(
    context.buildContext
  ).createBuildStepsFromFunctionGroupCall(context.globalCtx, {
    callInputs: { flow_path: flowPath, env: envVars },
  });
}

describe('Maestro Test Commands', () => {
  it('generates single command for iOS', () => {
    const context = createTestContext(Platform.IOS);
    const envVars = { TEST_VAR: 'hello' };
    const flowPath = 'myflow.yaml';
    const expectedCommand = `maestro test ${getEnvFlags(envVars)} ${flowPath}`;

    const maestroSteps = getMaestroSteps(createMaestroSteps(context, flowPath, envVars));
    expect(maestroSteps).toHaveLength(1);
    expect(maestroSteps[0].command).toBe(expectedCommand);
  });

  it('generates multiple commands for Android flows', () => {
    const context = createTestContext(Platform.ANDROID);
    const envVars = { API_KEY: '12345' };
    const flowPaths = ['flow1.yaml', 'flow2.yaml'];
    const expectedCommands = flowPaths.map(
      (flowPath) => `maestro test ${getEnvFlags(envVars)} ${flowPath}`
    );

    const maestroSteps = getMaestroSteps(
      createMaestroSteps(context, flowPaths.join('\n'), envVars)
    );
    expect(maestroSteps).toHaveLength(2);
    maestroSteps.forEach((step: BuildStep, index: number) => {
      expect(step.command).toBe(expectedCommands[index]);
    });
  });
});

describe('getEnvFlags', () => {
  it('generates correct env flags string', () => {
    expect(getEnvFlags()).toBe('');
    expect(getEnvFlags({})).toBe('');
    expect(getEnvFlags({ TEST_VAR: 'hello' })).toBe('-e TEST_VAR=hello');
    expect(getEnvFlags({ VAR1: 'value1', VAR2: 'value2' })).toBe('-e VAR1=value1 -e VAR2=value2');
  });
});
