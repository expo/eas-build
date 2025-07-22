import { randomUUID } from 'node:crypto';

import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  spawnAsync,
} from '@expo/steps';
import { z } from 'zod';
import spawn, { SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
import { PipeMode } from '@expo/logger';

import {
  cloneIosSimulator,
  getBootedSimulatorDevices,
  startIosScreenRecording,
  stopIosScreenRecording,
} from './startIosSimulator';
import {
  cloneAndroidEmulator,
  getBootedEmulatorDevices,
  startAndroidScreenRecording,
  stopAndroidScreenRecording,
} from './startAndroidEmulator';

export function createEasMaestroTestFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'maestro_test',
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
        .parse(_inputs);

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
          stepCtx.logger.info(`Using booted iOS Simulator: ${device.name}.`);

          stepCtx.logger.info(`Stopping Simulator...`);
          await spawnAsync('xcrun', ['simctl', 'shutdown', device.udid], {
            logger: stepCtx.logger,
            stdio: 'pipe',
          });

          sourceDeviceName = device.udid;
          break;
        }
        case 'android': {
          const bootedDevices = await getBootedEmulatorDevices({ env });
          if (bootedDevices.length === 0) {
            throw new Error('No booted Android Emulator found.');
          } else if (bootedDevices.length > 1) {
            throw new Error('Multiple booted Android Emulators found.');
          }

          const serialId = bootedDevices[0];
          const adbEmuAvdNameResult = await spawn('adb', ['-s', serialId, 'emu', 'avd', 'name'], {
            mode: PipeMode.COMBINED,
            env,
          });
          const avdName = adbEmuAvdNameResult.stdout.replace(/\r\n/g, '\n').split('\n')[0];

          stepCtx.logger.info(`Using booted Android Emulator: ${avdName}.`);

          stepCtx.logger.info(`Stopping Emulator...`);
          await spawnAsync('adb', ['-s', serialId, 'emu', 'kill'], {
            logger: stepCtx.logger,
            stdio: 'pipe',
          });

          sourceDeviceName = avdName;
          break;
        }
      }

      for (const [flowPath, flowIndex] of Object.entries(flow_paths)) {
        for (let retryIndex = 0; retryIndex < retries; retryIndex++) {
          const localDeviceName = `eas-simulator-${flowIndex}-${retryIndex}`;
          // start device
          switch (platform) {
            case 'ios': {
              await cloneIosSimulator({
                sourceDeviceName,
                destinationDeviceName: localDeviceName,
                env,
              });
              // boot device
              break;
            }
            case 'android': {
              await cloneAndroidEmulator({
                sourceDeviceName,
                destinationDeviceName: localDeviceName,
                env,
              });
              // boot device
              break;
            }
          }

          let recordingSpawn: SpawnPromise<SpawnResult> | undefined;
          let outputPath: string | undefined;
          if (record_screen) {
            switch (platform) {
              case 'ios': {
                const iosScreenRecording = await startIosScreenRecording({
                  deviceName: localDeviceName,
                  env,
                });
                recordingSpawn = iosScreenRecording.recordingSpawn;
                outputPath = iosScreenRecording.outputPath;
                break;
              }
              case 'android': {
                const androidScreenRecording = await startAndroidScreenRecording({
                  deviceName: localDeviceName,
                  env,
                });
                recordingSpawn = androidScreenRecording.recordingSpawn;
                break;
              }
            }
          }

          try {
            const [command, ...args] = getMaestroTestCommand({
              flow_path: flowPath,
              include_tags,
              exclude_tags,
              output_format,
              output_path: getOutputPathForOutputFormat(output_format ?? 'noop') ?? undefined,
            });

            await spawnAsync(command, args, {
              logger: stepCtx.logger,
              cwd: stepCtx.workingDirectory,
              env,
              stdio: 'pipe',
            });
          } catch (err) {
            stepCtx.logger.error(`Error running maestro test: ${err}`);

            if (retryIndex < retries - 1) {
              stepCtx.logger.error(`Retrying...`);
            } else {
              stepCtx.logger.error(`Failed to run maestro test after ${retries} retries.`);
              throw err;
            }
          } finally {
            if (recordingSpawn) {
              switch (platform) {
                case 'ios': {
                  await stopIosScreenRecording({ recordingSpawn });
                  break;
                }
                case 'android': {
                  const androidScreenRecording = await stopAndroidScreenRecording({
                    deviceName: localDeviceName,
                    recordingSpawn,
                    env,
                  });
                  outputPath = androidScreenRecording.outputPath;
                  break;
                }
              }
            }

            if (outputPath) {
              stepCtx.logger.info(`Recording saved to ${outputPath}.`);
            }

            // stop device
          }
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
    includeTagsFlag = `--include-tags="${params.include_tags}"`;
  }

  let excludeTagsFlag = '';
  if (typeof params.exclude_tags === 'string') {
    excludeTagsFlag = `--exclude-tags="${params.exclude_tags}"`;
  }

  let outputFormatFlag = '';
  if (params.output_format === 'junit') {
    outputFormatFlag = `--format=JUNIT --output="${params.output_path}"`;
  }

  return [
    'maestro',
    'test',
    includeTagsFlag,
    excludeTagsFlag,
    outputFormatFlag,
    params.flow_path,
  ].flatMap((e) => e || []) as [command: string, ...args: string[]];
}

function getOutputPathForOutputFormat(outputFormat: string): string | null {
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

  return [
    '$HOME/.maestro/tests/maestro-',
    outputFormat,
    '-',
    randomUUID(),
    // No . if no extension.
    ...(extension ? ['.', extension] : []),
  ].join('');
}
