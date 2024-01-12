import path from 'path';
import assert from 'assert';

import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';

import { resolveGradleCommand, runGradleCommand } from '../utils/android/gradle';

export function runGradleFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'run_gradle',
    name: 'Run gradle',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'command',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async (stepCtx, { env, inputs }) => {
      assert(stepCtx.global.staticContext.job, 'Job is required');
      const command = resolveGradleCommand(
        stepCtx.global.staticContext.job,
        inputs.command.value as string | undefined,
      );
      await runGradleCommand({
        logger: stepCtx.logger,
        gradleCommand: command,
        androidDir: path.join(stepCtx.workingDirectory, 'android'),
        env,
      });
    },
  });
}
