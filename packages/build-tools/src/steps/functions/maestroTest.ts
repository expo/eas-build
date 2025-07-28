import { randomUUID } from 'node:crypto';
import path from 'node:path';

import {
  BuildFunction,
  BuildStepEnv,
  BuildStepInput,
  BuildStepInputValueTypeName,
  spawnAsync,
} from '@expo/steps';
import { z } from 'zod';
import spawn, { SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
import { PipeMode, bunyan } from '@expo/logger';
import { Result, asyncResult, result } from '@expo/results';
import { GenericArtifactType } from '@expo/eas-build-job';

import { CustomBuildContext } from '../../customBuildContext';

import {
  startIosSimulator,
  cloneIosSimulator,
  getBootedSimulatorDevices,
  startIosScreenRecording,
  stopIosScreenRecording,
  ensureIosSimulatorIsReadyAsync,
  stopAndDeleteIosSimulator,
} from './startIosSimulator';
import {
  cloneAndroidEmulator,
  ensureAndroidEmulatorIsReadyAsync,
  getBootedEmulatorDevices,
  startAndroidScreenRecording,
  startAndroidSimulator,
  stopAndDeleteAndroidEmulator,
  stopAndroidScreenRecording,
} from './startAndroidEmulator';

export function createInternalEasMaestroTestFunction(ctx: CustomBuildContext): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: '__maestro_test',
    inputProviders: [
      BuildStepInput.createProvider({
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        id: 'platform',
        required: true,
      }),
      BuildStepInput.createProvider({
        allowedValueTypeName: BuildStepInputValueTypeName.JSON,
        id: 'flow_paths',
        required: true,
      }),
      BuildStepInput.createProvider({
        allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
        id: 'retries',
        defaultValue: 1,
        required: false,
      }),
      BuildStepInput.createProvider({
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        id: 'include_tags',
        required: false,
      }),
      BuildStepInput.createProvider({
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        id: 'exclude_tags',
        required: false,
      }),
      BuildStepInput.createProvider({
        allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
        id: 'shards',
        defaultValue: 1,
        required: false,
      }),
      BuildStepInput.createProvider({
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        id: 'output_format',
        required: false,
      }),
      BuildStepInput.createProvider({
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
        id: 'record_screen',
        defaultValue: false,
        required: false,
      }),
    ],
    fn: async (stepCtx, { inputs: _inputs, env }) => {
      console.log('maestroTest', _inputs);
      // inputs come in form of { value: unknown }. Here we parse them into a typed and validated object.
      const {
        platform,
        flow_paths,
        retries,
        include_tags,
        exclude_tags,
        shards,
        output_format,
        record_screen,
      } = z
        .object({
          platform: z.enum(['ios', 'android']),
          flow_paths: z.array(z.string()),
          retries: z.number().default(1),
          include_tags: z.string().optional(),
          exclude_tags: z.string().optional(),
          shards: z.number().default(1),
          output_format: z.string().optional(),
          record_screen: z.boolean().default(false),
        })
        .parse(
          Object.fromEntries(Object.entries(_inputs).map(([key, value]) => [key, value.value]))
        );

      // TODO: Add support for shards. (Shouldn't be too difficult.)
      if (shards > 1) {
        stepCtx.logger.warn(
          'Sharding support has been temporarily disabled. Running tests on a single shard.'
        );
      }

      let sourceDeviceName: string;

      switch (platform) {
        case 'ios': {
          const bootedDevices = await getBootedSimulatorDevices({ env });
          if (bootedDevices.length === 0) {
            throw new Error('No booted iOS Simulator found.');
          } else if (bootedDevices.length > 1) {
            throw new Error('Multiple booted iOS Simulators found.');
          }

          const device = bootedDevices[0];
          stepCtx.logger.info(`Running tests on iOS Simulator: ${device.name}.`);

          stepCtx.logger.info(`Preparing Simulator for tests...`);
          await spawnAsync('xcrun', ['simctl', 'shutdown', device.udid], {
            logger: stepCtx.logger,
            stdio: 'pipe',
          });

          sourceDeviceName = device.name;
          break;
        }
        case 'android': {
          const bootedDevices = await getBootedEmulatorDevices({ env });
          if (bootedDevices.length === 0) {
            throw new Error('No booted Android Emulator found.');
          } else if (bootedDevices.length > 1) {
            throw new Error('Multiple booted Android Emulators found.');
          }

          const { serialId } = bootedDevices[0];
          const adbEmuAvdNameResult = await spawn('adb', ['-s', serialId, 'emu', 'avd', 'name'], {
            mode: PipeMode.COMBINED,
            env,
          });
          const avdName = adbEmuAvdNameResult.stdout.replace(/\r\n/g, '\n').split('\n')[0];
          stepCtx.logger.info(`Running tests on Android Emulator: ${avdName}.`);

          stepCtx.logger.info(`Preparing Emulator for tests...`);
          await spawnAsync('adb', ['-s', serialId, 'emu', 'kill'], {
            logger: stepCtx.logger,
            stdio: 'pipe',
          });

          sourceDeviceName = avdName;
          break;
        }
      }

      for (const [flowIndex, flowPath] of flow_paths.entries()) {
        for (let retryIndex = 0; retryIndex < retries; retryIndex++) {
          const localDeviceIdentifier = `eas-simulator-${flowIndex}-${retryIndex}`;

          // If the test passes, but the recording fails, we don't want to make the test fail,
          // so we return two separate results.
          const { fnResult, recordingResult } = await withCleanDeviceAsync({
            platform,
            sourceDeviceName,
            localDeviceName: localDeviceIdentifier,
            env,
            logger: stepCtx.logger,
            fn: async () => {
              return await maybeWithScreenRecordingAsync({
                shouldRecord: record_screen,
                platform,
                deviceName: localDeviceIdentifier,
                env,
                logger: stepCtx.logger,
                fn: async () => {
                  const [command, ...args] = getMaestroTestCommand({
                    flow_path: flowPath,
                    include_tags,
                    exclude_tags,
                    output_format,
                    output_path:
                      getOutputPathForOutputFormat({
                        outputFormat: output_format ?? 'noop',
                        env,
                      }) ?? undefined,
                  });

                  await spawnAsync(command, args, {
                    logger: stepCtx.logger,
                    cwd: stepCtx.workingDirectory,
                    env,
                    stdio: 'pipe',
                  });
                },
              });
            },
          });

          if (recordingResult.ok && recordingResult.value) {
            try {
              await ctx.runtimeApi.uploadArtifact({
                logger: stepCtx.logger,
                artifact: {
                  name: `Screen Recording (${flowPath}, retry ${retryIndex})`,
                  paths: [recordingResult.value],
                  type: GenericArtifactType.OTHER,
                },
              });
            } catch (err) {
              stepCtx.logger.warn('Failed to upload screen recording.', err);
            }
          }

          if (fnResult.ok) {
            stepCtx.logger.info(`Test passed.`);
            // Break out of the retry loop.
            break;
          }

          stepCtx.logger.error(`Failed to run test on device: ${fnResult.reason}`);
          stepCtx.logger.error(`Retrying...`);
        }
      }
    },
  });
}

export function getMaestroTestCommand(params: {
  flow_path: string;
  include_tags: string | undefined;
  exclude_tags: string | undefined;
  output_format: string | undefined;
  output_path: string | undefined;
}): [command: string, ...args: string[]] {
  let includeTagsFlag = '';
  if (typeof params.include_tags === 'string') {
    includeTagsFlag = `--include-tags=${params.include_tags}`;
  }

  let excludeTagsFlag = '';
  if (typeof params.exclude_tags === 'string') {
    excludeTagsFlag = `--exclude-tags=${params.exclude_tags}`;
  }

  let outputFormatFlags: string[] = [];
  if (params.output_format) {
    outputFormatFlags = [`--format=${params.output_format}`, `--output=${params.output_path}`];
  }

  return [
    'maestro',
    'test',
    includeTagsFlag,
    excludeTagsFlag,
    ...outputFormatFlags,
    params.flow_path,
  ].flatMap((e) => e || []) as [command: string, ...args: string[]];
}

function getOutputPathForOutputFormat({
  outputFormat,
  env,
}: {
  outputFormat: string;
  env: BuildStepEnv;
}): string | null {
  if (outputFormat.toLowerCase() === 'noop') {
    return null;
  }

  let extension: string | null;
  switch (outputFormat) {
    case 'junit':
      extension = 'xml';
      break;
    case 'html':
      extension = 'html';
      break;
    default:
      extension = null;
      break;
  }

  return path.join(
    env.HOME!,
    '.maestro',
    'tests',
    [
      'maestro-',
      outputFormat,
      '-',
      randomUUID(),
      // No . if no extension.
      ...(extension ? ['.', extension] : []),
    ].join('')
  );
}

async function withCleanDeviceAsync<TResult>({
  platform,
  sourceDeviceName,
  localDeviceName,
  env,
  logger,
  fn,
}: {
  platform: 'ios' | 'android';
  sourceDeviceName: string;
  localDeviceName: string;
  env: BuildStepEnv;
  logger: bunyan;
  fn: () => Promise<TResult>;
}): Promise<TResult> {
  // Clone and start the device

  switch (platform) {
    case 'ios': {
      logger.info(`Cloning iOS Simulator ${sourceDeviceName} to ${localDeviceName}...`);
      await cloneIosSimulator({
        sourceDeviceName,
        destinationDeviceName: localDeviceName,
        env,
      });
      logger.info(`Starting iOS Simulator ${localDeviceName}...`);
      await startIosSimulator({
        deviceIdentifier: localDeviceName,
        env,
      });
      logger.info(`Waiting for iOS Simulator ${localDeviceName} to be ready...`);
      await ensureIosSimulatorIsReadyAsync({
        deviceIdentifier: localDeviceName,
        env,
      });
      break;
    }
    case 'android': {
      logger.info(`Cloning Android Emulator ${sourceDeviceName} to ${localDeviceName}...`);
      await cloneAndroidEmulator({
        sourceDeviceName,
        destinationDeviceName: localDeviceName,
        env,
      });
      logger.info(`Starting Android Emulator ${localDeviceName}...`);
      await startAndroidSimulator({
        deviceName: localDeviceName,
        env,
      });
      logger.info(`Waiting for Android Emulator ${localDeviceName} to be ready...`);
      await ensureAndroidEmulatorIsReadyAsync({
        deviceName: localDeviceName,
        env,
        logger,
      });
      break;
    }
  }

  // Run the function

  const fnResult = await asyncResult(fn());

  // Stop the device

  try {
    switch (platform) {
      case 'ios': {
        logger.info(`Cleaning up ${localDeviceName}...`);
        await stopAndDeleteIosSimulator({
          deviceName: localDeviceName,
          env,
        });
        break;
      }
      case 'android': {
        logger.info(`Cleaning up ${localDeviceName}...`);
        await stopAndDeleteAndroidEmulator({
          deviceName: localDeviceName,
          env,
        });
        break;
      }
    }
  } catch (err) {
    logger.error(`Error cleaning up device: ${err}`);
  }

  return fnResult.enforceValue();
}

/** Runs provided `fn` function, optionally wrapping it with starting and stopping screen recording. */
async function maybeWithScreenRecordingAsync<TResult>({
  shouldRecord,
  platform,
  deviceName,
  env,
  logger,
  fn,
}: {
  // As weird as it is, it's more convenient to have this function like `maybeWith...`
  // than "withScreenRecordingAsync" and `withScreenRecordingAsync(fn)` vs `fn` in the caller.
  shouldRecord: boolean;
  platform: 'ios' | 'android';
  deviceName: string;
  env: BuildStepEnv;
  logger: bunyan;
  fn: () => Promise<TResult>;
}): Promise<{ fnResult: Result<TResult>; recordingResult: Result<string | null> }> {
  if (!shouldRecord) {
    return { fnResult: await asyncResult(fn()), recordingResult: result(null) };
  }

  let recordingResult: Result<{
    recordingSpawn: SpawnPromise<SpawnResult>;
    outputPath?: string;
  }>;

  // Start screen recording

  logger.info(`Starting screen recording on ${deviceName}...`);

  switch (platform) {
    case 'ios': {
      recordingResult = await asyncResult(
        startIosScreenRecording({
          deviceIdentifier: deviceName,
          env,
        })
      );
      break;
    }
    case 'android': {
      recordingResult = await asyncResult(
        startAndroidScreenRecording({
          deviceName,
          env,
        })
      );
      break;
    }
  }

  if (!recordingResult.ok) {
    logger.warn('Failed to start screen recording.', recordingResult.reason);
  }

  // Run the function

  const fnResult = await asyncResult(fn());

  // If recording failed there's nothing to stop, so we return the results

  if (!recordingResult.ok) {
    return { fnResult, recordingResult: result(recordingResult.reason) };
  }

  // If recording started, finish it

  try {
    logger.info(`Stopping screen recording on ${deviceName}...`);

    switch (platform) {
      case 'ios': {
        await stopIosScreenRecording({ recordingSpawn: recordingResult.value.recordingSpawn });
        return {
          fnResult,
          // We know outputPath is defined, because startIosScreenRecording() should have filled it.
          recordingResult: result(recordingResult.value.outputPath!),
        };
      }
      case 'android': {
        const { outputPath } = await stopAndroidScreenRecording({
          deviceName,
          recordingSpawn: recordingResult.value.recordingSpawn,
          env,
        });
        return { fnResult, recordingResult: result(outputPath) };
      }
    }
  } catch (err) {
    logger.warn('Failed to stop screen recording.', err);

    return { fnResult, recordingResult: result(err as Error) };
  }
}
