import crypto from 'crypto';

import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  BuildStepOutput,
} from '@expo/steps';

function createCacheKey(cacheKey: string, paths: string[]): string {
  const hash = crypto.createHash('sha256');
  hash.update(paths.sort().join(''));

  const pathsHash = hash.digest('hex');

  return `${cacheKey}-${pathsHash}`;
}

export function createRestoreCacheBuildFunction(): BuildFunction {
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
        allowedValueTypeName: BuildStepInputValueTypeName.JSON,
      }),
    ],
    outputProviders: [
      BuildStepOutput.createProvider({
        id: 'cache_key',
        required: true,
      }),
    ],
    fn: async (stepsCtx, { inputs, outputs }) => {
      const cacheManager = stepsCtx.global.cacheManager;

      if (!cacheManager) {
        return;
      }

      outputs.cache_key.set(inputs.key.value as string);
      const paths = inputs.paths.value as [string];
      const key = createCacheKey(inputs.key.value as string, paths);

      cacheManager.generateUrls = true;
      const {
        job: { cache },
      } = stepsCtx.global.provider.staticContext();

      if (!(cache.downloadUrls && key in cache.downloadUrls)) {
        stepsCtx.logger.info(`Cache ${key} does not exist, skipping restoring`);
        return;
      }
      stepsCtx.logger.info(`Restoring cache ${key} in:\n ${paths.join('\n')}`);

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

export function createSaveCacheBuildFunction(): BuildFunction {
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
      BuildStepInput.createProvider({
        id: 'paths',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.JSON,
      }),
    ],
    fn: async (stepsCtx, { inputs }) => {
      const cacheManager = stepsCtx.global.cacheManager;

      if (!cacheManager) {
        return;
      }
      const paths = inputs.paths.value as [string];
      const key = createCacheKey(inputs.key.value as string, paths);

      const {
        job: { cache },
      } = stepsCtx.global.provider.staticContext();
      if (cache.downloadUrls && key in cache.downloadUrls) {
        stepsCtx.logger.info(`Cache ${key} already exists, skipping saving`);
        return;
      }

      stepsCtx.logger.info(`Saving cache from:\n ${paths.join('\n')}`);

      cacheManager.generateUrls = true;

      await cacheManager.saveCache(stepsCtx, {
        disabled: false,
        clear: false,
        key,
        paths,
      });
      stepsCtx.logger.info('Cache saved');
    },
  });
}
