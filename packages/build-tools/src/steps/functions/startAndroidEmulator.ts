import assert from 'assert';

import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import spawn from '@expo/turtle-spawn';
import { v4 as uuidv4 } from 'uuid';
import { PipeMode } from '@expo/logger';

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
        id: 'system_image_package',
        required: false,
        defaultValue: defaultSystemImagePackage,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async ({ logger }, { inputs }) => {
      const deviceName = 'EasAndroidDevice01';
      const systemImagePackage = `${inputs.system_image_package.value}`;
      logger.info('Making sure system image is installed');
      await spawn('sdkmanager', [systemImagePackage], {
        logger,
      });

      logger.info('Creating emulator device');
      await spawn(
        'avdmanager',
        ['create', 'avd', '--name', deviceName, '--package', systemImagePackage, '--force'],
        {
          ignoreStdio: true,
        }
      );

      const emuPropId = uuidv4();

      logger.info('Starting emulator device');
      const emulatorPromise = spawn(
        `${process.env.ANDROID_HOME}/emulator/emulator`,
        [
          '-no-window',
          '-no-boot-anim',
          '-writable-system',
          '-noaudio',
          '-avd',
          deviceName,
          '-prop',
          `qemu.uuid=${emuPropId}`,
        ],
        {
          detached: true,
          stdio: 'ignore',
        }
      );
      // If emulator fails to start, throw its error.
      if (!emulatorPromise.child.pid) {
        await emulatorPromise;
      }
      emulatorPromise.child.unref();

      logger.info('Waiting for emulator to become ready');
      await spawn('adb', ['wait-for-device']);

      const serialId = await getEmulatorSerialId({ emuPropId });
      assert(serialId, 'Failed to configure emulator: emulator with required ID not found.');

      let hasBootCompleted = false;
      while (!hasBootCompleted) {
        const { stdout } = await spawn(
          'adb',
          ['-s', serialId, 'shell', 'getprop', 'sys.boot_completed'],
          {
            mode: PipeMode.COMBINED,
          }
        );
        if (stdout.startsWith('1')) {
          hasBootCompleted = true;
        }
      }

      logger.info(`${deviceName} is ready.`);
    },
  });
}

async function getEmulatorSerialId({ emuPropId }: { emuPropId: string }): Promise<string | null> {
  const adbDevices = await spawn('adb', ['devices'], { mode: PipeMode.COMBINED });
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
    });
    if (getProp.stdout.startsWith(emuPropId)) {
      return serialId;
    }
  }

  return null;
}
