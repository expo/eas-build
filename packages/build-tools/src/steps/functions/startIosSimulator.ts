import fs from 'node:fs';
import os from 'node:os';
import { setTimeout } from 'timers/promises';
import path from 'node:path';

import { PipeMode } from '@expo/logger';
import {
  BuildFunction,
  BuildStepEnv,
  BuildStepInput,
  BuildStepInputValueTypeName,
} from '@expo/steps';
import spawn, { SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
import { minBy } from 'lodash';

import { retryAsync } from '../../utils/retry';

export function createStartIosSimulatorBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'start_ios_simulator',
    name: 'Start iOS Simulator',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'device_identifier',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'count',
        required: false,
        defaultValue: 1,
        allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
      }),
    ],
    fn: async ({ logger }, { inputs, env }) => {
      try {
        const availableDevices = await getAvailableSimulatorDevices({ env, filter: 'available' });
        logger.info(
          `Available Simulator devices:\n- ${availableDevices
            .map(formatSimulatorDevice)
            .join(`\n- `)}`
        );
      } catch (error) {
        logger.info('Failed to list available Simulator devices.', error);
      } finally {
        logger.info('');
      }

      const originalDeviceIdentifier =
        inputs.device_identifier.value?.toString() ?? (await findMostGenericIphone({ env }))?.name;

      if (!originalDeviceIdentifier) {
        throw new Error('Could not find an iPhone among available simulator devices.');
      }

      const { udid } = await startIosSimulator({
        deviceIdentifier: originalDeviceIdentifier,
        env,
      });

      await ensureIosSimulatorIsReady({
        deviceIdentifier: originalDeviceIdentifier,
        env,
      });

      logger.info('');

      const device = udid ? await getSimulatorDevice({ udid, env }) : null;
      const formattedDevice = device ? formatSimulatorDevice(device) : originalDeviceIdentifier;
      logger.info(`${formattedDevice} is ready.`);

      const count = Number(inputs.count.value ?? 1);
      if (count > 1) {
        logger.info(`Requested ${count} Simulators, shutting down ${formattedDevice} for cloning.`);
        await spawn('xcrun', ['simctl', 'shutdown', originalDeviceIdentifier], {
          logger,
          env,
        });

        for (let i = 0; i < count; i++) {
          const cloneIdentifier = `eas-simulator-${i + 1}`;
          logger.info(`Cloning ${formattedDevice} to ${cloneIdentifier}...`);

          await cloneIosSimulator({
            sourceDeviceName: originalDeviceIdentifier,
            destinationDeviceName: cloneIdentifier,
            env,
          });

          await startIosSimulator({
            deviceIdentifier: cloneIdentifier,
            env,
          });

          await ensureIosSimulatorIsReady({
            deviceIdentifier: cloneIdentifier,
            env,
          });

          logger.info(`${cloneIdentifier} is ready.`);
          logger.info('');
        }
      }
    },
  });
}

async function findMostGenericIphone({
  env,
}: {
  env: BuildStepEnv;
}): Promise<AvailableXcrunSimctlDevice | null> {
  const availableSimulatorDevices = await getAvailableSimulatorDevices({
    env,
    filter: 'available',
  });
  const availableIphones = availableSimulatorDevices.filter((device) =>
    device.name.startsWith('iPhone')
  );
  // It's funny, but it works.
  const iphoneWithShortestName = minBy(availableIphones, (device) => device.name.length);
  return iphoneWithShortestName ?? null;
}

function formatSimulatorDevice(device: XcrunSimctlDevice & { runtime: string }): string {
  return `${device.name} (${device.udid}) on ${device.runtime}`;
}

function parseUdidFromBootstatusStdout(stdout: string): string | null {
  const matches = stdout.match(/^Monitoring boot status for .+ \((.+)\)\.$/m);
  if (!matches) {
    return null;
  }
  return matches[1];
}

async function getSimulatorDevice({
  udid,
  env,
}: {
  udid: string;
  env: BuildStepEnv;
}): Promise<SimulatorDevice | null> {
  const devices = await getAvailableSimulatorDevices({ env, filter: 'available' });
  return devices.find((device) => device.udid === udid) ?? null;
}

export async function getBootedSimulatorDevices({
  env,
}: {
  env: BuildStepEnv;
}): Promise<SimulatorDevice[]> {
  return await getAvailableSimulatorDevices({ env, filter: 'booted' });
}

async function getAvailableSimulatorDevices({
  env,
  filter,
}: {
  env: BuildStepEnv;
  filter: 'available' | 'booted';
}): Promise<SimulatorDevice[]> {
  const result = await spawn(
    'xcrun',
    ['simctl', 'list', 'devices', '--json', '--no-escape-slashes', filter],
    {
      env,
      mode: PipeMode.COMBINED_AS_STDOUT,
    }
  );
  const xcrunData = JSON.parse(
    result.stdout
  ) as XcrunSimctlListDevicesJsonOutput<AvailableXcrunSimctlDevice>;

  const allAvailableDevices: (AvailableXcrunSimctlDevice & { runtime: string })[] = [];
  for (const [runtime, devices] of Object.entries(xcrunData.devices)) {
    allAvailableDevices.push(...devices.map((device) => ({ ...device, runtime })));
  }

  return allAvailableDevices;
}

type XcrunSimctlDevice = {
  availabilityError?: string;
  /** e.g. /Users/sjchmiela/Library/Developer/CoreSimulator/Devices/8272DEB1-42B5-4F78-AB2D-0BC5F320B822/data */
  dataPath: string;
  /** e.g. 18341888 */
  dataPathSize: number;
  /** e.g. /Users/sjchmiela/Library/Logs/CoreSimulator/8272DEB1-42B5-4F78-AB2D-0BC5F320B822 */
  logPath: string;
  /** e.g. 8272DEB1-42B5-4F78-AB2D-0BC5F320B822 */
  udid: string;
  isAvailable: boolean;
  /** e.g. com.apple.CoreSimulator.SimDeviceType.iPhone-13-mini */
  deviceTypeIdentifier: string;
  state: 'Shutdown' | 'Booted';
  /** e.g. iPhone 15 */
  name: string;
  /** e.g. 2024-01-22T19:28:56Z */
  lastBootedAt?: string;
};

type SimulatorDevice = AvailableXcrunSimctlDevice & { runtime: string };

type AvailableXcrunSimctlDevice = XcrunSimctlDevice & {
  availabilityError?: never;
  isAvailable: true;
};

type XcrunSimctlListDevicesJsonOutput<TDevice extends XcrunSimctlDevice = XcrunSimctlDevice> = {
  devices: {
    [runtime: string]: TDevice[];
  };
};

export async function cloneIosSimulator({
  sourceDeviceName,
  destinationDeviceName,
  env,
}: {
  sourceDeviceName: string;
  destinationDeviceName: string;
  env: BuildStepEnv;
}): Promise<void> {
  await spawn('xcrun', ['simctl', 'clone', sourceDeviceName, destinationDeviceName], {
    env,
  });
}

export async function startIosSimulator({
  deviceIdentifier,
  env,
}: {
  deviceIdentifier: string;
  env: BuildStepEnv;
}): Promise<{ udid: string }> {
  const bootstatusResult = await spawn('xcrun', ['simctl', 'bootstatus', deviceIdentifier, '-b'], {
    env,
  });

  const udid = parseUdidFromBootstatusStdout(bootstatusResult.stdout);
  if (!udid) {
    throw new Error('Failed to parse UDID from bootstatus result.');
  }

  return { udid };
}

export async function ensureIosSimulatorIsReady({
  deviceIdentifier,
  env,
}: {
  deviceIdentifier: string;
  env: BuildStepEnv;
}): Promise<void> {
  await retryAsync(
    async () => {
      await spawn('xcrun', ['simctl', 'io', deviceIdentifier, 'screenshot', '/dev/null'], {
        env,
      });
    },
    {
      retryOptions: {
        // There's 30 * 60 seconds in 30 minutes, which is the timeout.
        retries: 30 * 60,
        retryIntervalMs: 1_000,
      },
    }
  );
}

export async function startIosScreenRecording({
  deviceIdentifier,
  env,
}: {
  deviceIdentifier: string;
  env: BuildStepEnv;
}): Promise<{
  recordingSpawn: SpawnPromise<SpawnResult>;
  outputPath: string;
}> {
  const outputDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ios-screen-recording-'));
  const outputPath = path.join(outputDir, `${deviceIdentifier}.mov`);
  const recordingSpawn = spawn(
    'xcrun',
    ['simctl', 'io', deviceIdentifier, 'recordVideo', '-f', outputPath],
    { env, mode: PipeMode.COMBINED }
  );

  const stdout = recordingSpawn.child.stdout;
  const stderr = recordingSpawn.child.stderr;
  if (!stdout || !stderr) {
    // No stdout/stderr means the process failed to start, so awaiting it will throw an error.
    await recordingSpawn;
    throw new Error('Recording process failed to start.');
  }

  let outputAggregated = '';

  // Listen to both stdout and stderr since "Recording started" might come from either
  stdout.on('data', (data) => {
    const output = data.toString();
    outputAggregated += output;
  });

  stderr.on('data', (data) => {
    const output = data.toString();
    outputAggregated += output;
  });

  let isRecordingStarted = false;
  for (let i = 0; i < 20; i++) {
    // Check if recording started message appears in either stdout or stderr
    if (outputAggregated.includes('Recording started')) {
      isRecordingStarted = true;
      break;
    }
    await setTimeout(1000);
  }

  if (!isRecordingStarted) {
    throw new Error('Recording not started in time.');
  }

  // We are returning the SpawnPromise here, so we don't await it.
  // eslint-disable-next-line @typescript-eslint/return-await
  return { recordingSpawn, outputPath };
}

export async function stopIosScreenRecording({
  recordingSpawn,
}: {
  recordingSpawn: SpawnPromise<SpawnResult>;
}): Promise<void> {
  // TODO: In shell implementation we wait for "Wrote video" in the log file.
  //       Confirm we don't need to do that here.
  recordingSpawn.child.kill(2);
  await recordingSpawn;
}
