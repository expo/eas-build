import assert from 'assert';
import fs from 'fs/promises';
import { setTimeout } from 'timers/promises';

import { PipeMode, bunyan } from '@expo/logger';
import {
  BuildFunction,
  BuildStepEnv,
  BuildStepInput,
  BuildStepInputValueTypeName,
  spawnAsync,
} from '@expo/steps';
import spawn, { SpawnPromise, SpawnResult } from '@expo/turtle-spawn';

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
        id: 'device_identifier',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'system_image_package',
        required: false,
        defaultValue: defaultSystemImagePackage,
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
        const availableDevices = await getAvailableEmulatorDevices({ env });
        logger.info(`Available Android devices:\n- ${availableDevices.join(`\n- `)}`);
      } catch (error) {
        logger.info('Failed to list available Android devices.', error);
      } finally {
        logger.info('');
      }

      const deviceName = `${inputs.device_name.value}`;
      const systemImagePackage = `${inputs.system_image_package.value}`;
      // We can cast because allowedValueTypeName validated this is a string.
      const deviceIdentifier = inputs.device_identifier.value as string | undefined;

      logger.info('Making sure system image is installed');
      await retryAsync(
        async () => {
          await spawn('sdkmanager', [systemImagePackage], {
            env,
            logger,
          });
        },
        {
          logger,
          retryOptions: {
            retries: 3, // Retry 3 times
            retryIntervalMs: 1_000,
          },
        }
      );

      logger.info('Creating emulator device');
      const avdManager = spawn(
        'avdmanager',
        [
          'create',
          'avd',
          '--name',
          deviceName,
          '--package',
          systemImagePackage,
          '--force',
          ...(deviceIdentifier ? ['--device', deviceIdentifier] : []),
        ],
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

      logger.info('Starting emulator device');
      const { emulatorPromise } = await startAndroidSimulator({ deviceName, env });

      logger.info('Waiting for emulator to become ready');
      const { serialId } = await ensureEmulatorIsReadyAsync({
        deviceName,
        env,
        logger,
      });

      logger.info(`${deviceName} is ready.`);

      const count = Number(inputs.count.value ?? 1);
      if (count > 1) {
        logger.info(`Requested ${count} emulators, shutting down ${deviceName} for cloning.`);
        await spawn('adb', ['-s', serialId, 'shell', 'reboot', '-p'], {
          logger,
          env,
        });
        // Waiting for source emulator to shutdown.
        await emulatorPromise;

        for (let i = 0; i < count; i++) {
          const cloneIdentifier = `eas-simulator-${i + 1}`;
          logger.info(`Cloning ${deviceName} to ${cloneIdentifier}...`);
          await cloneAndroidEmulator({
            sourceDeviceName: deviceName,
            destinationDeviceName: cloneIdentifier,
            env,
          });

          logger.info('Starting emulator device');
          await startAndroidSimulator({ deviceName: cloneIdentifier, env });

          logger.info('Waiting for emulator to become ready');
          await ensureEmulatorIsReadyAsync({
            deviceName: cloneIdentifier,
            env,
            logger,
          });

          logger.info(`${cloneIdentifier} is ready.`);
        }
      }
    },
  });
}

async function startAndroidSimulator({
  deviceName,
  env,
}: {
  deviceName: string;
  env: BuildStepEnv;
}): Promise<{ emulatorPromise: SpawnPromise<SpawnResult> }> {
  const emulatorPromise = spawn(
    `${process.env.ANDROID_HOME}/emulator/emulator`,
    [
      '-no-window',
      '-no-boot-anim',
      '-writable-system',
      '-noaudio',
      '-memory',
      '8192',
      '-no-snapshot-save',
      '-avd',
      deviceName,
    ],
    {
      detached: true,
      stdio: 'inherit',
      env,
    }
  );
  // If emulator fails to start, throw its error.
  if (!emulatorPromise.child.pid) {
    await emulatorPromise;
  }
  emulatorPromise.child.unref();

  // We don't want to await the SpawnPromise here.
  // eslint-disable-next-line @typescript-eslint/return-await
  return { emulatorPromise };
}

async function getEmulatorSerialId({
  deviceName,
  env,
}: {
  deviceName: string;
  env: BuildStepEnv;
}): Promise<string | null> {
  const adbDevices = await spawn('adb', ['devices'], { mode: PipeMode.COMBINED, env });
  for (const adbDeviceLine of adbDevices.stdout.split('\n')) {
    if (!adbDeviceLine.startsWith('emulator')) {
      continue;
    }

    const matches = adbDeviceLine.match(/^(\S+)/);
    if (!matches) {
      continue;
    }

    const [, serialId] = matches;
    // Previously we were using `qemu.uuid` to identify the emulator,
    // but this does not work for newer emulators, because there is
    // a limit on properties and custom properties get ignored.
    // See https://stackoverflow.com/questions/2214377/how-to-get-serial-number-or-id-of-android-emulator-after-it-runs#comment98259121_42038655
    const adbEmuAvdName = await spawn('adb', ['-s', serialId, 'emu', 'avd', 'name'], {
      mode: PipeMode.COMBINED,
      env,
    });
    if (adbEmuAvdName.stdout.replace(/\r\n/g, '\n').split('\n')[0] === deviceName) {
      return serialId;
    }
  }

  return null;
}

async function ensureEmulatorIsReadyAsync({
  deviceName,
  env,
  logger,
}: {
  deviceName: string;
  env: BuildStepEnv;
  logger: bunyan;
}): Promise<{ serialId: string }> {
  const serialId = await retryAsync(
    async () => {
      const serialId = await getEmulatorSerialId({ deviceName, env });
      assert(
        serialId,
        `Failed to configure emulator (${deviceName}): emulator with required ID not found.`
      );
      return serialId;
    },
    {
      logger,
      retryOptions: {
        retries: 3 * 60,
        retryIntervalMs: 1_000,
      },
    }
  );

  await retryAsync(
    async () => {
      const { stdout } = await spawn(
        'adb',
        ['-s', serialId, 'shell', 'getprop', 'sys.boot_completed'],
        {
          env,
          mode: PipeMode.COMBINED,
        }
      );

      if (!stdout.startsWith('1')) {
        throw new Error(`Emulator (${deviceName}) boot has not completed.`);
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

  return { serialId };
}

async function getAvailableEmulatorDevices({ env }: { env: BuildStepEnv }): Promise<string[]> {
  const result = await spawn('avdmanager', ['list', 'device', '--compact', '--null'], {
    env,
    mode: PipeMode.COMBINED_AS_STDOUT,
  });
  return result.stdout.split('\0').filter((line) => line !== '');
}

export async function getBootedEmulatorDevices({ env }: { env: BuildStepEnv }): Promise<string[]> {
  const result = await spawn('adb', ['devices', '-l'], {
    env,
    mode: PipeMode.COMBINED_AS_STDOUT,
  });
  return result.stdout
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.startsWith('emulator'))
    .map((line) => line.split(' ')[0]);
}

export async function cloneAndroidEmulator({
  sourceDeviceName,
  destinationDeviceName,
  env,
}: {
  sourceDeviceName: string;
  destinationDeviceName: string;
  env: BuildStepEnv;
}): Promise<void> {
  const cloneIniFile = `${env.HOME}/.android/avd/${destinationDeviceName}.ini`;

  await fs.rm(`${env.HOME}/.android/avd/${destinationDeviceName}.avd`, {
    recursive: true,
    force: true,
  });
  await fs.rm(cloneIniFile, { force: true });

  await fs.cp(
    `${env.HOME}/.android/avd/${sourceDeviceName}.avd`,
    `${env.HOME}/.android/avd/${destinationDeviceName}.avd`,
    { recursive: true, verbatimSymlinks: true, force: true }
  );

  await fs.cp(`${env.HOME}/.android/avd/${sourceDeviceName}.ini`, cloneIniFile, {
    verbatimSymlinks: true,
    force: true,
  });

  const filesToReplaceDeviceNameIn = (
    await spawnAsync('grep', [
      '--binary-files=without-match',
      '--recursive',
      '--files-with-matches',
      `${sourceDeviceName}`,
      `${env.HOME}/.android/avd/${destinationDeviceName}.avd`,
    ])
  ).stdout
    .split('\n')
    .filter((file) => file !== '');

  for (const file of [...filesToReplaceDeviceNameIn, cloneIniFile]) {
    const txtFile = await fs.readFile(file, 'utf-8');
    const replaceRegex = new RegExp(`${sourceDeviceName}`, 'g');
    const updatedTxtFile = txtFile.replace(replaceRegex, destinationDeviceName);
    await fs.writeFile(file, updatedTxtFile);
  }
}

export async function startAndroidScreenRecording({
  deviceName,
  env,
}: {
  deviceName: string;
  env: BuildStepEnv;
}): Promise<{
  recordingSpawn: SpawnPromise<SpawnResult>;
}> {
  let isReady = false;

  // Ensure /sdcard/ is ready to write to. (If the emulator was just booted, it might not be ready yet.)
  for (let i = 0; i < 10; i++) {
    try {
      await spawn('adb', ['-s', deviceName, 'shell', 'touch', '/sdcard/.expo-recording-ready'], {
        env,
      });
      isReady = true;
      break;
    } catch {
      await setTimeout(1000);
    }
  }

  if (!isReady) {
    throw new Error(`Emulator (${deviceName}) filesystem was not ready in time.`);
  }

  const screenrecordArgs = [
    '-s',
    deviceName,
    'shell',
    'screenrecord',
    '--verbose',
    '/sdcard/expo-recording.mp4',
  ];

  const screenrecordHelp = await spawn(
    'adb',
    ['-s', deviceName, 'shell', 'screenrecord', '--help'],
    { env }
  );

  if (screenrecordHelp.stdout.includes('remove the time limit')) {
    screenrecordArgs.push('--time-limit', '0');
  }

  // We are returning the SpawnPromise here, so we don't await it.
  // eslint-disable-next-line @typescript-eslint/return-await
  return {
    recordingSpawn: spawn('adb', screenrecordArgs, {
      env,
      stdio: 'pipe',
    }),
  };
}
