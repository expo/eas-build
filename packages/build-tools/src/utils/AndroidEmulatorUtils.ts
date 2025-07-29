import assert from 'assert';
import fs from 'node:fs';
import os from 'node:os';
import { setTimeout } from 'node:timers/promises';
import path from 'node:path';

import { PipeMode } from '@expo/logger';
import spawn, { SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
import { z } from 'zod';

import { retryAsync } from './retry';

/** Android Virtual Device is the device we run. */
export type AndroidVirtualDeviceName = string & z.BRAND<'AndroidVirtualDeviceName'>;
/** Android device is configuration for the AVD -- screen size, etc. */
export type AndroidDeviceName = string & z.BRAND<'AndroidDeviceName'>;
export type AndroidDeviceSerialId = string & z.BRAND<'AndroidDeviceSerialId'>;

export namespace AndroidEmulatorUtils {
  export async function getAvailableDevicesAsync({
    env,
  }: {
    env: NodeJS.ProcessEnv;
  }): Promise<AndroidDeviceName[]> {
    const result = await spawn('avdmanager', ['list', 'device', '--compact', '--null'], { env });
    return result.stdout.split('\0').filter((line) => line !== '') as AndroidDeviceName[];
  }

  export async function getConnectedDevicesAsync({
    env,
  }: {
    env: NodeJS.ProcessEnv;
  }): Promise<AndroidDeviceSerialId[]> {
    const result = await spawn('adb', ['devices', '-l'], {
      env,
      mode: PipeMode.COMBINED_AS_STDOUT,
    });
    return result.stdout
      .replace(/\r\n/g, '\n')
      .split('\n')
      .filter((line) => line.startsWith('emulator'))
      .map((line) => {
        const [serialId] = line.split(' ')[0];
        return serialId as AndroidDeviceSerialId;
      });
  }

  export async function getSerialIdAsync({
    deviceName,
    env,
  }: {
    deviceName: AndroidVirtualDeviceName;
    env: NodeJS.ProcessEnv;
  }): Promise<AndroidDeviceSerialId | null> {
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
        return serialId as AndroidDeviceSerialId;
      }
    }

    return null;
  }

  export async function cloneAsync({
    sourceDeviceName,
    destinationDeviceName,
    env,
  }: {
    sourceDeviceName: AndroidVirtualDeviceName;
    destinationDeviceName: AndroidVirtualDeviceName;
    env: NodeJS.ProcessEnv;
  }): Promise<void> {
    const cloneIniFile = `${env.HOME}/.android/avd/${destinationDeviceName}.ini`;

    await fs.promises.rm(`${env.HOME}/.android/avd/${destinationDeviceName}.avd`, {
      recursive: true,
      force: true,
    });
    await fs.promises.rm(cloneIniFile, { force: true });

    await fs.promises.cp(
      `${env.HOME}/.android/avd/${sourceDeviceName}.avd`,
      `${env.HOME}/.android/avd/${destinationDeviceName}.avd`,
      { recursive: true, verbatimSymlinks: true, force: true }
    );

    await fs.promises.cp(`${env.HOME}/.android/avd/${sourceDeviceName}.ini`, cloneIniFile, {
      verbatimSymlinks: true,
      force: true,
    });

    const filesToReplaceDeviceNameIn = // TODO: Test whether we need to use `spawnAsync` here.
      (
        await spawn('grep', [
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
      const txtFile = await fs.promises.readFile(file, 'utf-8');
      const replaceRegex = new RegExp(`${sourceDeviceName}`, 'g');
      const updatedTxtFile = txtFile.replace(replaceRegex, destinationDeviceName);
      await fs.promises.writeFile(file, updatedTxtFile);
    }
  }

  export async function startAsync({
    deviceName,
    env,
  }: {
    deviceName: AndroidVirtualDeviceName;
    env: NodeJS.ProcessEnv;
  }): Promise<{ emulatorPromise: SpawnPromise<SpawnResult>; serialId: AndroidDeviceSerialId }> {
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

    const serialId = await retryAsync(
      async () => {
        const serialId = await getSerialIdAsync({ deviceName, env });
        assert(
          serialId,
          `Failed to configure emulator (${serialId}): emulator with required ID not found.`
        );
        return serialId;
      },
      {
        retryOptions: {
          retries: 3 * 60,
          retryIntervalMs: 1_000,
        },
      }
    );

    // We don't want to await the SpawnPromise here.
    // eslint-disable-next-line @typescript-eslint/return-await
    return { emulatorPromise, serialId };
  }

  export async function waitForReadyAsync({
    serialId,
    env,
  }: {
    serialId: AndroidDeviceSerialId;
    env: NodeJS.ProcessEnv;
  }): Promise<void> {
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
          throw new Error(`Emulator (${serialId}) boot has not completed.`);
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
  }

  export async function deleteAsync({
    serialId,
    env,
  }: {
    serialId: AndroidDeviceSerialId;
    env: NodeJS.ProcessEnv;
  }): Promise<void> {
    const adbEmuAvdName = await spawn('adb', ['-s', serialId, 'emu', 'avd', 'name'], {
      mode: PipeMode.COMBINED,
      env,
    });
    const deviceName = adbEmuAvdName.stdout.replace(/\r\n/g, '\n').split('\n')[0];

    await spawn('adb', ['-s', serialId, 'emu', 'kill'], { env });
    await spawn('avdmanager', ['delete', 'avd', '-n', deviceName], { env });
  }

  export async function startScreenRecordingAsync({
    serialId,
    env,
  }: {
    serialId: AndroidDeviceSerialId;
    env: NodeJS.ProcessEnv;
  }): Promise<{
    recordingSpawn: SpawnPromise<SpawnResult>;
  }> {
    let isReady = false;

    // Ensure /sdcard/ is ready to write to. (If the emulator was just booted, it might not be ready yet.)
    for (let i = 0; i < 10; i++) {
      try {
        await spawn('adb', ['-s', serialId, 'shell', 'touch', '/sdcard/.expo-recording-ready'], {
          env,
        });
        isReady = true;
        break;
      } catch {
        await setTimeout(1000);
      }
    }

    if (!isReady) {
      throw new Error(`Emulator (${serialId}) filesystem was not ready in time.`);
    }

    const screenrecordArgs = [
      '-s',
      serialId,
      'shell',
      'screenrecord',
      '--verbose',
      '/sdcard/expo-recording.mp4',
    ];

    const screenrecordHelp = await spawn(
      'adb',
      ['-s', serialId, 'shell', 'screenrecord', '--help'],
      {
        env,
      }
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

  export async function stopScreenRecordingAsync({
    serialId,
    recordingSpawn,
    env,
  }: {
    serialId: AndroidDeviceSerialId;
    recordingSpawn: SpawnPromise<SpawnResult>;
    env: NodeJS.ProcessEnv;
  }): Promise<{ outputPath: string }> {
    recordingSpawn.child.kill(1);

    let isRecordingBusy = true;
    for (let i = 0; i < 10; i++) {
      const lsof = await spawn(
        'adb',
        ['-s', serialId, 'shell', 'lsof -t /sdcard/expo-recording.mp4 | wc -l'],
        { env }
      );
      if (lsof.stdout.trim() === '0') {
        isRecordingBusy = false;
        break;
      }
      await setTimeout(1000);
    }

    if (isRecordingBusy) {
      throw new Error(`Recording file is busy.`);
    }

    const outputDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), 'android-screen-recording-')
    );
    const outputPath = path.join(outputDir, `${serialId}.mp4`);

    await spawn('adb', ['-s', serialId, 'pull', '/sdcard/expo-recording.mp4', outputPath], { env });

    return { outputPath };
  }
}
