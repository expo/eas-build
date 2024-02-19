import { BuildJob } from '@expo/eas-build-job';
import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  BuildStepOutput,
} from '@expo/steps';

import { CustomBuildContext } from '../../customBuildContext';

export function createRestoreCacheBuildFunction(ctx: CustomBuildContext): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'restore-cache',
    name: 'Restore Cache',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'key',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'paths',
        required: true,
        defaultValue: [],
        allowedValueTypeName: BuildStepInputValueTypeName.JSON,
      }),
    ],
    outputProviders: [
      BuildStepOutput.createProvider({
        id: 'cache_key',
        required: true,
      }),
      BuildStepOutput.createProvider({
        id: 'cache_paths',
        required: false,
      }),
    ],
    fn: async (stepsCtx, { inputs, outputs }) => {
      const cacheManager = ctx.runtimeApi.cacheManager;

      const key = inputs.key.value as string;
      const paths = inputs.paths.value as [string];
      outputs.cache_key.set(key);
      if (paths.length > 0) {
        outputs.cache_paths.set(JSON.stringify(paths));
      }

      if (!cacheManager) {
        stepsCtx.logger.warn('Cache manager is not available, skipping...');
        return;
      }

      const job = stepsCtx.global.staticContext.job as BuildJob;
      const cache = job.cache;
      if (!cache) {
        return;
      }

      stepsCtx.logger.info(`Restoring cache ${inputs.key.value} from:`);
      paths.forEach((path) => {
        stepsCtx.logger.info(`- ${path}`);
      });

      await cacheManager.restoreCache(stepsCtx, {
        ...cache,
        disabled: false,
        clear: false,
        key,
        paths,
      });
    },
  });
}

export function createSaveCacheBuildFunction(ctx: CustomBuildContext): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'save-cache',
    name: 'Save Cache',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'key',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async (stepsCtx, { inputs }) => {
      const cacheManager = ctx.runtimeApi.cacheManager;

      if (!cacheManager) {
        stepsCtx.logger.warn('Cache manager is not available, skipping...');
        return;
      }

      await cacheManager.saveCache(stepsCtx, {
        disabled: false,
        clear: false,
        key: inputs.key.value as string,
        paths: [],
      });
    },
  });
}
