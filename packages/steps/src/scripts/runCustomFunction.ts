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
        stream: {
          write: (rec: any) => {
            if (rec) {
              switch (rec.level) {
                case 30: // Info level
                  if (rec.msg) {
                    console.log(rec.msg);
                  }
                  break;
                case 40: // Warn level
                  if (rec.msg) {
                    console.warn(rec.msg);
                  }
                  break;
                case 50: // Error level
                case 60: // Fatal level
                  if (rec.msg) {
                    console.error(rec.msg);
                  }
                  break;
                default:
                  break;
              }
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
