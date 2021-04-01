import path from 'path';

import { BuildContext, EjectProvider } from '@expo/build-tools';
import { Android, Ios } from '@expo/eas-build-job';
import spawnAsync from '@expo/spawn-async';
import fs from 'fs-extra';

type ManagedJob = Android.ManagedJob | Ios.ManagedJob;

const expoCliPackage = require.resolve('expo-cli');

export class LocalExpoCliEjectProvider implements EjectProvider<ManagedJob> {
  async runEject(ctx: BuildContext<ManagedJob>): Promise<void> {
    const { logger, job } = ctx;

    const spawnOptions = {
      cwd: ctx.buildDirectory,
      stdio: ['pipe', 'inherit', 'inherit'] as ('pipe' | 'inherit')[],
      env: ctx.env,
    };

    await fs.remove(path.join(ctx.reactNativeProjectDirectory, 'android'));
    await fs.remove(path.join(ctx.reactNativeProjectDirectory, 'ios'));

    if (!(await fs.pathExists(path.join(ctx.buildDirectory, '.git')))) {
      await spawnAsync('git', ['init', '.'], spawnOptions);
      await spawnAsync('git', ['add', '-A'], spawnOptions);
      await spawnAsync(
        'git',
        [
          '-c',
          "user.name='EAS Build'",
          '-c',
          "user.email='secure@expo.io'",
          'commit',
          '-q',
          '-m',
          '"init"',
        ],
        spawnOptions
      );
    }

    const expoCliBinPath =
      process.env.EXPO_CLI_PATH ?? path.resolve(path.dirname(expoCliPackage), '../bin/expo.js');
    logger.debug(`${expoCliBinPath} prebuild --non-interactive --platform ${job.platform}`);
    await spawnAsync(
      expoCliBinPath,
      ['prebuild', '--non-interactive', '--platform', job.platform],
      {
        ...spawnOptions,
        cwd: ctx.reactNativeProjectDirectory,
      }
    );

    await spawnAsync(ctx.packageManager, ['install'], {
      ...spawnOptions,
      cwd: ctx.reactNativeProjectDirectory,
    });
  }
}
