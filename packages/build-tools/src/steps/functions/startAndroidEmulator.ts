import assert from 'assert';

import { PipeMode } from '@expo/logger';
import {
  BuildFunction,
  BuildStepEnv,
  BuildStepInput,
  BuildStepInputValueTypeName,
  spawnAsync,
} from '@expo/steps';
import { v4 as uuidv4 } from 'uuid';

import { retryAsync } from '../../utils/retry';

const defaultSystemImagePackage = `system-images;android-30;default;${
  process.arch === 'arm64' ? 'arm64-v8a' : 'x86_64'
}`;

export function createStartAndroidEmulatorBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'start_android_emulator',
    name: 'Start Android Emulator',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'device_name',
        required: false,
        defaultValue: 'EasAndroidDevice01',
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'system_image_package',
        required: false,
        defaultValue: defaultSystemImagePackage,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async ({ logger }, { inputs, env }) => {
      const deviceName = `${inputs.device_name.value}`;
      const systemImagePackage = `${inputs.system_image_package.value}`;
      logger.info('Making sure system image is installed');
      await spawnAsync('sdkmanager', [systemImagePackage], {
        env,
        logger,
        stdio: 'pipe',
      });

      logger.info('Creating emulator device');
      const avdManager = spawnAsync(
        'avdmanager',
        ['create', 'avd', '--name', deviceName, '--package', systemImagePackage, '--force'],
        {
          env,
          stdio: 'pipe',
        }
      );
      // `avdmanager create` always asks about creating a custom hardware profile.
      // > Do you wish to create a custom hardware profile? [no]
      // We answer "no".
      avdManager.child.stdin?.write('no');
      avdManager.child.stdin?.end();
      await avdManager;

      const qemuPropId = uuidv4();

      logger.info('Starting emulator device');
      await startAndroidSimulator({ deviceName, qemuPropId, env });

      logger.info('Waiting for emulator to become ready');
      const serialId = await retryAsync(
        async () => {
          const serialId = await getEmulatorSerialId({ qemuPropId, env });
          assert(serialId, 'Failed to configure emulator: emulator with required ID not found.');
          return serialId;
        },
        {
          logger,
          retryOptions: {
            // Emulators usually take 30 second tops to boot.
            retries: 60,
            retryIntervalMs: 1_000,
          },
        }
      );

      await retryAsync(
        async () => {
          const { stdout } = await spawnAsync(
            'adb',
            ['-s', serialId, 'shell', 'getprop', 'sys.boot_completed'],
            {
              env,
              mode: PipeMode.COMBINED,
            }
          );

          if (!stdout.startsWith('1')) {
            throw new Error('Emulator boot has not completed.');
          }
        },
        {
          // Retry every second for 3 minutes.
          retryOptions: {
            retries: 3 * 60,
            retryIntervalMs: 1_000,
          },
        }
      );

      logger.info(`${deviceName} is ready.`);
    },
  });
}

async function startAndroidSimulator({
  deviceName,
  qemuPropId,
  env,
}: {
  deviceName: string;
  qemuPropId: string;
  env: BuildStepEnv;
}): Promise<void> {
  const emulatorPromise = spawnAsync(
    `${process.env.ANDROID_HOME}/emulator/emulator`,
    [
      '-no-window',
      '-no-boot-anim',
      '-writable-system',
      '-noaudio',
      '-avd',
      deviceName,
      '-prop',
      `qemu.uuid=${qemuPropId}`,
    ],
    {
      detached: true,
      stdio: 'ignore',
      env,
    }
  );
  // If emulator fails to start, throw its error.
  if (!emulatorPromise.child.pid) {
    await emulatorPromise;
  }
  emulatorPromise.child.unref();
}

async function getEmulatorSerialId({
  qemuPropId,
  env,
}: {
  qemuPropId: string;
  env: BuildStepEnv;
}): Promise<string | null> {
  const adbDevices = await spawnAsync('adb', ['devices'], { mode: PipeMode.COMBINED, env });
  for (const adbDeviceLine of adbDevices.stdout.split('\n')) {
    if (!adbDeviceLine.startsWith('emulator')) {
      continue;
    }

    const matches = adbDeviceLine.match(/^(\S+)/);
    if (!matches) {
      continue;
    }

    const [, serialId] = matches;
    const getProp = await spawnAsync('adb', ['-s', serialId, 'shell', 'getprop', 'qemu.uuid'], {
      mode: PipeMode.COMBINED,
      env,
    });
    if (getProp.stdout.startsWith(qemuPropId)) {
      return serialId;
    }
  }

  return null;
}
