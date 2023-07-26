import assert from 'assert';

import { createLogger } from '@expo/logger';

import { BuildStepOutput } from '../BuildStepOutput.js';
import { BuildStepInput } from '../BuildStepInput.js';
import { SerializedCustomBuildFunctionArguments } from '../utils/customFunction.js';
import { BuildStepContext } from '../BuildStepContext.js';
import { BuildStepFunction } from '../BuildStep.js';

async function runCustomJsFunctionAsync(): Promise<void> {
  const customJavascriptFunctionModulePath = process.argv[2];
  const functionArgs = process.argv[3];

  assert(customJavascriptFunctionModulePath, 'customJavascriptFunctionModulePath is required');
  assert(functionArgs, 'serializedFunctionParams is required');

  let serializedFunctionArguments: SerializedCustomBuildFunctionArguments;
  try {
    serializedFunctionArguments = JSON.parse(functionArgs);
  } catch (e) {
    console.error('Failed to parse serializedFunctionParams');
    throw e;
  }

  const logger = createLogger({
    name: 'customJavscriptFunctionLogger',
    streams: [
      {
        type: 'raw',
        level: 'info',
        stream: {
          write(rec: any) {
            if (rec.msg) {
              console.log(rec.msg);
            }
          },
        },
      },
      {
        type: 'raw',
        level: 'warn',
        stream: {
          write(rec: any) {
            if (rec.msg) {
              console.warn(rec.msg);
            }
          },
        },
      },
      {
        type: 'raw',
        level: 'error',
        stream: {
          write(rec: any) {
            if (rec.msg) {
              console.error(rec.msg);
            }
          },
        },
      },
      {
        type: 'raw',
        level: 'fatal',
        stream: {
          write(rec: any) {
            if (rec.msg) {
              console.error(rec.msg);
            }
          },
        },
      },
    ],
  });

  const ctx = BuildStepContext.deserialize(serializedFunctionArguments.ctx, logger);
  const inputs = Object.fromEntries(
    Object.entries(serializedFunctionArguments.inputs).map(([id, input]) => [
      id,
      BuildStepInput.deserialize(input, logger),
    ])
  );
  const outputs = Object.fromEntries(
    Object.entries(serializedFunctionArguments.outputs).map(([id, output]) => [
      id,
      BuildStepOutput.deserialize(output, logger),
    ])
  );
  const env = serializedFunctionArguments.env;

  let customModule: any;
  try {
    customModule = await require(customJavascriptFunctionModulePath);
  } catch (e) {
    console.error('Failed to load custom javascript function module');
    throw e;
  }

  const customJavascriptFunction: BuildStepFunction = customModule.default;

  await customJavascriptFunction(ctx, { inputs, outputs, env });
}

void runCustomJsFunctionAsync();
