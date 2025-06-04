import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Platform } from '@expo/eas-build-job';
import { type bunyan } from '@expo/logger';
import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  BuildStepOutput,
  spawnAsync,
} from '@expo/steps';
import {
  repackAppAndroidAsync,
  repackAppIosAsync,
  type Logger,
  type SpawnProcessAsync,
  type SpawnProcessOptions,
  type SpawnProcessPromise,
  type SpawnProcessResult,
} from '@expo/repack-app';

import { COMMON_FASTLANE_ENV } from '../../common/fastlane';

export function createRepackBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'repack',
    name: 'Repack app',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'source_app_path',
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        required: true,
      }),
      BuildStepInput.createProvider({
        id: 'platform',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'output_path',
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        required: false,
      }),
      BuildStepInput.createProvider({
        id: 'embed_bundle_assets',
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
        required: false,
      }),
    ],
    outputProviders: [
      BuildStepOutput.createProvider({
        id: 'output_path',
        required: true,
      }),
    ],
    fn: async (stepsCtx, { inputs, outputs, env }) => {
      const projectRoot = stepsCtx.workingDirectory;
      const verbose = stepsCtx.global.env['EAS_VERBOSE'] === '1';

      const platform =
        (inputs.platform.value as Platform) ?? stepsCtx.global.staticContext.job.platform;
      if (![Platform.ANDROID, Platform.IOS].includes(platform)) {
        throw new Error(
          `Unsupported platform: ${platform}. Platform must be "${Platform.ANDROID}" or "${Platform.IOS}"`
        );
      }

      const repackLogger = createBunyanLoggerAdapter(stepsCtx.logger);
      const repackSpawnAsync = createSpawnAsyncStepAdapter({ verbose, logger: stepsCtx.logger });

      const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), `repack-`));
      const workingDirectory = path.join(tmpDir, 'working-directory');
      await fs.promises.mkdir(workingDirectory);
      stepsCtx.logger.info(`Created temporary working directory: ${workingDirectory}`);

      const sourceAppPath = inputs.source_app_path.value as string;
      const outputPath =
        (inputs.output_path.value as string) ??
        path.join(tmpDir, `repacked-${randomUUID()}${path.extname(sourceAppPath)}`);

      stepsCtx.logger.info('Repacking the app...');
      switch (platform) {
        case Platform.IOS:
          await repackAppIosAsync({
            platform: 'ios',
            projectRoot,
            sourceAppPath,
            outputPath,
            workingDirectory,
            // TODO: add iosSigningOptions
            logger: repackLogger,
            spawnAsync: repackSpawnAsync,
            verbose,
            env: {
              ...COMMON_FASTLANE_ENV,
              ...env,
            },
          });
          break;
        case Platform.ANDROID:
          await repackAppAndroidAsync({
            platform: 'android',
            projectRoot,
            sourceAppPath,
            outputPath,
            workingDirectory,
            // TODO: add androidSigningOptions
            logger: repackLogger,
            spawnAsync: repackSpawnAsync,
            verbose,
            env,
          });
          break;
      }

      stepsCtx.logger.info(`Repacked the app to ${outputPath}`);
      outputs.output_path.set(outputPath);
    },
  });
}

/**
 * Creates a Bunyan logger adapter for repack logger
 */
export function createBunyanLoggerAdapter(logger: bunyan): Logger {
  const timerMap: Record<string, number> = {};

  return {
    debug(...message: any[]): void {
      logger.debug(message.join(''));
    },
    info(...message: any[]): void {
      logger.info(message.join(''));
    },
    warn(...message: any[]): void {
      logger.warn(message.join(''));
    },
    error(...message: any[]): void {
      logger.error(message.join(''));
    },
    time(label: string): void {
      timerMap[label] = Date.now();
    },
    timeEnd(label: string): void {
      if (timerMap[label] == null) {
        logger.warn(`Timer '${label}' does not exist`);
        return;
      }
      const duration = Date.now() - timerMap[label];
      logger.info(`${label}: ${duration} ms`);
      delete timerMap[label];
    },
  };
}

/**
 * Creates `@expo/steps` based spawnAsync for repack.
 */
function createSpawnAsyncStepAdapter({
  verbose,
  logger,
}: {
  verbose: boolean;
  logger: bunyan;
}): SpawnProcessAsync {
  return function repackSpawnAsync(
    command: string,
    args: string[],
    options?: SpawnProcessOptions
  ): SpawnProcessPromise<SpawnProcessResult> {
    return spawnAsync(command, args, {
      ...options,
      ...(verbose ? { logger, stdio: 'pipe' } : { logger: undefined }),
    });
  };
}
