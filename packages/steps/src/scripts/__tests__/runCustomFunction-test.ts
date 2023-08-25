import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { createContext } from 'this-file';
import { v4 as uuidv4 } from 'uuid';

import { BuildStepInput, BuildStepInputValueTypeName } from '../../BuildStepInput.js';
import { BuildStepOutput } from '../../BuildStepOutput.js';
import { BuildStepContext } from '../../BuildStepContext.js';
import {
  cleanUpStepTemporaryDirectoriesAsync,
  createTemporaryEnvsDirectoryAsync,
  createTemporaryOutputsDirectoryAsync,
} from '../../BuildTemporaryFiles.js';
import { createStepContextMock } from '../../__tests__/utils/context.js';
import { createCustomFunctionCall } from '../../utils/customFunction.js';
import { BIN_PATH } from '../../utils/shell/bin.js';

async function readWarningStatusAsync(envsDir: string): Promise<boolean> {
  const filePath = path.join(envsDir, 'EAS_BUILD_PHASE_HAS_WARNINGS');
  try {
    const rawContents = await fs.readFile(filePath, 'utf-8');
    return rawContents.trim() === 'true';
  } catch (e) {
    console.log(e);
    return false;
  }
}

type PrepareFunctionContext = {
  ctx: BuildStepContext;
  dirname: string;
  inputs: {
    name: BuildStepInput<BuildStepInputValueTypeName.STRING, true>;
    num: BuildStepInput<BuildStepInputValueTypeName.NUMBER, true>;
    obj: BuildStepInput<BuildStepInputValueTypeName.JSON, true>;
    isWarning: BuildStepInput<BuildStepInputValueTypeName.BOOLEAN, false>;
  };
  outputs: {
    name: BuildStepOutput<true>;
    num: BuildStepOutput<true>;
    obj: BuildStepOutput<true>;
  };
};

async function prepareCustomFunctionModuleAsync(): Promise<PrepareFunctionContext> {
  const dirname = createContext().dirname;
  const projectSourceDirectory = path.join(os.tmpdir(), 'eas-build', uuidv4());
  await fs.mkdir(projectSourceDirectory, { recursive: true });
  const ctx = createStepContextMock({
    workingDirectory: path.resolve(dirname, '../../__tests__/fixtures'),
    projectSourceDirectory,
  });
  const outputs = {
    name: new BuildStepOutput(ctx.global, {
      id: 'name',
      stepDisplayName: 'test',
      required: true,
    }),
    num: new BuildStepOutput(ctx.global, {
      id: 'num',
      stepDisplayName: 'test',
      required: true,
    }),
    obj: new BuildStepOutput(ctx.global, {
      id: 'obj',
      stepDisplayName: 'test',
      required: true,
    }),
  };
  const inputs = {
    name: new BuildStepInput(ctx.global, {
      id: 'name',
      stepDisplayName: 'test',
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
    }),
    num: new BuildStepInput(ctx.global, {
      id: 'num',
      stepDisplayName: 'test',
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
    }),
    obj: new BuildStepInput(ctx.global, {
      id: 'obj',
      stepDisplayName: 'test',
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
    }),
    isWarning: new BuildStepInput(ctx.global, {
      id: 'warning',
      stepDisplayName: 'warning',
      required: false,
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    }),
  };
  return {
    ctx,
    dirname,
    inputs,
    outputs,
  };
}

describe('runCustomFunction', () => {
  const currentPath = process.env.PATH;
  const newPath = currentPath ? `${BIN_PATH}:${currentPath}` : BIN_PATH;

  test('can run custom function', async () => {
    const { ctx, dirname, inputs, outputs } = await prepareCustomFunctionModuleAsync();

    inputs.name.set('foo');
    inputs.num.set(123);
    inputs.obj.set({ foo: 'bar' });

    try {
      const outputsDir = await createTemporaryOutputsDirectoryAsync(ctx.global, 'test');
      const envsDir = await createTemporaryEnvsDirectoryAsync(ctx.global, 'test');

      const fn = createCustomFunctionCall(
        path.resolve(dirname, '../../__tests__/fixtures/my-custom-ts-function')
      );
      const promise = fn(ctx, {
        env: {
          __EXPO_STEPS_OUTPUTS_DIR: outputsDir,
          __EXPO_STEPS_ENVS_DIR: envsDir,
          __EXPO_STEPS_WORKING_DIRECTORY: ctx.workingDirectory,
          PATH: newPath,
        },
        inputs,
        outputs,
      });
      await expect(promise).resolves.not.toThrow();
    } finally {
      await cleanUpStepTemporaryDirectoriesAsync(ctx.global, 'test');
    }
  });

  test('can set step status to `warning`', async () => {
    const { ctx, dirname, inputs, outputs } = await prepareCustomFunctionModuleAsync();

    inputs.name.set('foo');
    inputs.num.set(123);
    inputs.obj.set({ foo: 'bar' });
    inputs.isWarning.set(true);

    try {
      const outputsDir = await createTemporaryOutputsDirectoryAsync(ctx.global, 'test');
      const envsDir = await createTemporaryEnvsDirectoryAsync(ctx.global, 'test');

      const fn = createCustomFunctionCall(
        path.resolve(dirname, '../../__tests__/fixtures/my-custom-ts-function')
      );
      const env = {
        __EXPO_STEPS_OUTPUTS_DIR: outputsDir,
        __EXPO_STEPS_ENVS_DIR: envsDir,
        __EXPO_STEPS_WORKING_DIRECTORY: ctx.workingDirectory,
        PATH: newPath,
      };
      const promise = fn(ctx, {
        env,
        inputs,
        outputs,
      });
      await expect(promise).resolves.not.toThrow();
      expect(await readWarningStatusAsync(envsDir)).toBe(true);
    } finally {
      await cleanUpStepTemporaryDirectoriesAsync(ctx.global, 'test');
    }
  });
});
