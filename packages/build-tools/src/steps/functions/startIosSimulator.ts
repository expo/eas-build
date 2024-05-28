import { PipeMode } from '@expo/logger';
import {
  BuildFunction,
  BuildStepEnv,
  BuildStepInput,
  BuildStepInputValueTypeName,
  spawnAsync,
} from '@expo/steps';
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
    ],
    fn: async ({ logger }, { inputs, env }) => {
      try {
        const availableDevices = await getAvailableSimulatorDevices({ env });
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

      const deviceIdentifier =
        inputs.device_identifier.value?.toString() ?? (await findMostGenericIphone({ env }))?.name;

      if (!deviceIdentifier) {
        throw new Error('Could not find an iPhone among available simulator devices.');
      }

      const bootstatusResult = await spawnAsync(
        'xcrun',
        ['simctl', 'bootstatus', deviceIdentifier, '-b'],
        {
          logger,
          env,
          stdio: 'pipe',
        }
      );

      await retryAsync(
        async () => {
          await spawnAsync('xcrun', ['simctl', 'io', deviceIdentifier, 'screenshot', '/dev/null'], {
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

      logger.info('');

      const udid = parseUdidFromBootstatusStdout(bootstatusResult.stdout);
      const device = udid ? await getSimulatorDevice({ udid, env }) : null;
      logger.info(`${device ? formatSimulatorDevice(device) : deviceIdentifier} is ready.`);
    },
  });
}

async function findMostGenericIphone({
  env,
}: {
  env: BuildStepEnv;
}): Promise<AvailableXcrunSimctlDevice | null> {
  const availableSimulatorDevices = await getAvailableSimulatorDevices({ env });
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
  const devices = await getAvailableSimulatorDevices({ env });
  return devices.find((device) => device.udid === udid) ?? null;
}

async function getAvailableSimulatorDevices({
  env,
}: {
  env: BuildStepEnv;
}): Promise<SimulatorDevice[]> {
  const result = await spawnAsync(
    'xcrun',
    ['simctl', 'list', 'devices', '--json', '--no-escape-slashes', 'available'],
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
