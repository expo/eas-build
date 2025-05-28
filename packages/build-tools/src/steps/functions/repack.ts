import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { type Job, Platform } from '@expo/eas-build-job';
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
import { v4 as uuidv4 } from 'uuid';

import { pathExistsAsync } from '../../utils/files';

export function createRepackBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'repack',
    name: 'Repack app',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'source_app',
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
        id: 'working_directory',
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
      const repackSpawnAsync = createSpawnAsyncStepAdapter(verbose, stepsCtx.logger);

      const tmpDir = path.join(os.tmpdir(), `repack-${uuidv4()}`);
      const workingDirectory =
        (inputs.working_directory.value as string) ?? path.join(tmpDir, 'working-directory');
      await fs.promises.mkdir(workingDirectory, { recursive: true });
      stepsCtx.logger.info(`Created temporary workingDirectory: ${workingDirectory}`);

      const sourceAppPath = inputs.source_app.value as string;
      const outputPath =
        (inputs.output_path.value as string) ??
        createDefaultOutputPath({ tmpDir, job: stepsCtx.global.staticContext.job });

      stepsCtx.logger.info('Repacking the app...');
      if (platform === Platform.IOS) {
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
            FASTLANE_DISABLE_COLORS: '1',
            FASTLANE_SKIP_UPDATE_CHECK: '1',
            SKIP_SLOW_FASTLANE_WARNING: 'true',
            FASTLANE_HIDE_TIMESTAMP: 'true',
            LC_ALL: 'en_US.UTF-8',
            ...env,
          },
        });
      } else if (platform === Platform.ANDROID) {
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
      } else {
        throw new Error('Unsupported platform');
      }

      if (!(await pathExistsAsync(outputPath))) {
        throw new Error(`Failed to repack the app. ${outputPath} does not exist`);
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
function createSpawnAsyncStepAdapter(verbose: boolean, logger: bunyan): SpawnProcessAsync {
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

/**
 * Creates a default output path for the repacked app.
 */
export function createDefaultOutputPath({ tmpDir, job }: { tmpDir: string; job: Job }): string {
  const basename = 'repacked';
  let extname;
  if (job.platform === Platform.ANDROID) {
    extname = '.apk';
  } else if (job.platform === Platform.IOS) {
    extname = job.simulator ? '.app' : '.ipa';
  }
  return path.join(tmpDir, `${basename}${extname}`);
}
