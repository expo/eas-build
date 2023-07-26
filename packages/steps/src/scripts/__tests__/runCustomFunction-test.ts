import path from 'path';

import { createContext } from 'this-file';

import { BuildStepInput, BuildStepInputValueTypeName } from '../../BuildStepInput.js';
import { BuildStepOutput } from '../../BuildStepOutput.js';
import { createStepContextMock } from '../../__tests__/utils/context.js';
import { spawnAsync } from '../../utils/shell/spawn.js';
import {
  cleanUpStepTemporaryDirectoriesAsync,
  createTemporaryEnvsDirectoryAsync,
  createTemporaryOutputsDirectoryAsync,
} from '../../BuildTemporaryFiles.js';
import { BIN_PATH } from '../../utils/shell/bin.js';

describe('runCustomFunction', () => {
  test('can run custom function', async () => {
    const ctx = createStepContextMock();
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
    };
    inputs.name.set('foo');
    inputs.num.set(123);
    inputs.obj.set({ foo: 'bar' });

    const dirname = createContext().dirname;

    try {
      const outputsDir = await createTemporaryOutputsDirectoryAsync(ctx.global, 'test');
      const envsDir = await createTemporaryEnvsDirectoryAsync(ctx.global, 'test');

      const currentPath = process.env.PATH;
      const newPath = currentPath ? `${BIN_PATH}:${currentPath}` : BIN_PATH;
      const promise = spawnAsync('node', [
        path.resolve(dirname, '../../../dist_commonjs/scripts/runCustomFunction.cjs'),
        path.resolve(dirname, '../../__tests__/fixtures/my-custom-ts-function'),
        JSON.stringify({
          env: {
            __EXPO_STEPS_OUTPUTS_DIR: outputsDir,
            __EXPO_STEPS_ENVS_DIR: envsDir,
            __EXPO_STEPS_WORKING_DIRECTORY: ctx.workingDirectory,
            PATH: newPath,
          },
          inputs: Object.fromEntries(
            Object.entries(inputs).map(([id, input]) => [id, input.serialize()])
          ),
          outputs: Object.fromEntries(
            Object.entries(outputs).map(([id, output]) => [id, output.serialize()])
          ),
          ctx: ctx.serialize(),
        }),
      ]);
      await expect(promise).resolves.not.toThrow();
    } finally {
      await cleanUpStepTemporaryDirectoriesAsync(ctx.global, 'test');
    }
  });
});
