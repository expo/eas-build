import assert from 'assert';
import fs from 'fs/promises';

import { PipeMode, bunyan } from '@expo/logger';
import {
  BuildFunction,
  BuildStepEnv,
  BuildStepInput,
  BuildStepInputValueTypeName,
  spawnAsync,
} from '@expo/steps';
import spawn, { SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
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
      BuildStepInput.createProvider({
        id: 'count',
        required: false,
        defaultValue: 1,
        allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
      }),
    ],
    fn: async ({ logger }, { inputs, env }) => {
      const deviceName = `${inputs.device_name.value}`;
      const systemImagePackage = `${inputs.system_image_package.value}`;
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
      const { emulatorPromise } = await startAndroidSimulator({ deviceName, qemuPropId, env });

      logger.info('Waiting for emulator to become ready');
      const { serialId } = await ensureEmulatorIsReadyAsync({
        deviceName,
        qemuPropId,
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
          const cloneIniFile = `${process.env.HOME}/.android/avd/${cloneIdentifier}.ini`;

          await fs.rm(`${process.env.HOME}/.android/avd/${cloneIdentifier}.avd`, {
            recursive: true,
            force: true,
          });
          await fs.rm(cloneIniFile, { force: true });

          await fs.cp(
            `${process.env.HOME}/.android/avd/${deviceName}.avd`,
            `${process.env.HOME}/.android/avd/${cloneIdentifier}.avd`,
            { recursive: true, verbatimSymlinks: true, force: true }
          );

          await fs.cp(`${process.env.HOME}/.android/avd/${deviceName}.ini`, cloneIniFile, {
            verbatimSymlinks: true,
            force: true,
          });

          const filesToReplaceDeviceNameIn = (
            await spawnAsync('grep', [
              '--binary-files=without-match',
              '--recursive',
              '--files-with-matches',
              `${deviceName}`,
              `${process.env.HOME}/.android/avd/${cloneIdentifier}.avd`,
            ])
          ).stdout
            .split('\n')
            .filter((file) => file !== '');

          for (const file of [...filesToReplaceDeviceNameIn, cloneIniFile]) {
            const txtFile = await fs.readFile(file, 'utf-8');
            const replaceRegex = new RegExp(`${deviceName}`, 'g');
            const updatedTxtFile = txtFile.replace(replaceRegex, cloneIdentifier);
            await fs.writeFile(file, updatedTxtFile);
          }

          const qemuPropId = uuidv4();

          logger.info('Starting emulator device');
          await startAndroidSimulator({ deviceName: cloneIdentifier, qemuPropId, env });

          logger.info('Waiting for emulator to become ready');
          await ensureEmulatorIsReadyAsync({
            deviceName: cloneIdentifier,
            qemuPropId,
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
  qemuPropId,
  env,
}: {
  deviceName: string;
  qemuPropId: string;
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
      '-prop',
      `qemu.uuid=${qemuPropId}`,
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
  qemuPropId,
  env,
}: {
  qemuPropId: string;
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
    const getProp = await spawn('adb', ['-s', serialId, 'shell', 'getprop', 'qemu.uuid'], {
      mode: PipeMode.COMBINED,
      env,
    });
    if (getProp.stdout.startsWith(qemuPropId)) {
      return serialId;
    }
  }

  return null;
}

async function ensureEmulatorIsReadyAsync({
  deviceName,
  qemuPropId,
  env,
  logger,
}: {
  deviceName: string;
  qemuPropId: string;
  env: BuildStepEnv;
  logger: bunyan;
}): Promise<{ serialId: string }> {
  const serialId = await retryAsync(
    async () => {
      const serialId = await getEmulatorSerialId({ qemuPropId, env });
      assert(
        serialId,
        `Failed to configure emulator (${deviceName}): emulator with required ID not found.`
      );
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
