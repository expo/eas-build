import path from 'path';

import { createLogger } from '@expo/logger';

import { BuildStepInput, BuildStepInputJson } from '../BuildStepInput.js';
import { BuildStepContext, BuildStepContextJson } from '../BuildStepContext.js';
import { BuildStepOutput, BuildStepOutputJson } from '../BuildStepOutput.js';
import { BuildStepEnv } from '../BuildStepEnv.js';

async function runCustomJsFunctionAsync(): Promise<void> {
  const customJavascriptFunctionModulePath = process.argv[2];
  const serializedFunctionParams = process.argv[3];

  const functionParamsJson: {
    ctx: BuildStepContextJson;
    inputs: Record<string, BuildStepInputJson>;
    outputs: Record<string, BuildStepOutputJson>;
    env: BuildStepEnv;
  } = JSON.parse(serializedFunctionParams);

  const ctx = BuildStepContext.fromJSON(
    functionParamsJson.ctx,
    createLogger({
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
    })
  );
  const inputs = Object.keys(functionParamsJson.inputs).reduce((acc, key) => {
    acc[key] = BuildStepInput.fromJSON(functionParamsJson.inputs[key], ctx.global);
    return acc;
  }, {} as Record<string, BuildStepInput>);
  const outputs = Object.keys(functionParamsJson.outputs).reduce((acc, key) => {
    acc[key] = BuildStepOutput.fromJSON(functionParamsJson.outputs[key], ctx.global);
    return acc;
  }, {} as Record<string, BuildStepOutput>);

  const baseConfigDir = path.dirname(ctx.global.configPath);
  const { default: customJavascriptFunction } = await require(path.resolve(
    baseConfigDir,
    customJavascriptFunctionModulePath
  ));

  await customJavascriptFunction(ctx, { inputs, outputs, env: functionParamsJson.env });
}

void runCustomJsFunctionAsync();
