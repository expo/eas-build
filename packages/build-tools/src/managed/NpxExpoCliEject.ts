import path from 'path';

import spawn from '@expo/turtle-spawn';
import { Android, Ios } from '@expo/eas-build-job';
import fs from 'fs-extra';

import { BuildContext } from '../context';

import { EjectProvider, EjectOptions } from './EjectProvider';

type ManagedJob = Android.ManagedJob | Ios.ManagedJob;

class NpxExpoCliEjectProvider implements EjectProvider<ManagedJob> {
  async runEject(ctx: BuildContext<ManagedJob>, options?: EjectOptions): Promise<void> {
    const { logger, job } = ctx;

    const spawnOptions = {
      cwd: ctx.buildDirectory,
      logger,
      env: {
        ...options?.extraEnvs,
        ...ctx.env,
      },
    };

    await fs.remove(path.join(ctx.reactNativeProjectDirectory, 'android'));
    await fs.remove(path.join(ctx.reactNativeProjectDirectory, 'ios'));

    // TODO remove warnings from expo eject when running on turtle outside of git repo
    await spawn('git', ['init', '.'], spawnOptions);
    await spawn('git', ['add', '-A'], spawnOptions);
    await spawn(
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

    await spawn(
      'npx',
      ['expo-cli', 'prebuild', '--non-interactive', '--no-install', '--platform', job.platform],
      {
        ...spawnOptions,
        cwd: ctx.reactNativeProjectDirectory,
        env: {
          ...spawnOptions.env,
          ...(ctx.job.username ? { EAS_BUILD_USERNAME: ctx.job.username } : {}),
        },
      }
    );

    await spawn(ctx.packageManager, ['install'], {
      ...spawnOptions,
      cwd: ctx.reactNativeProjectDirectory,
    });
  }
}

export { NpxExpoCliEjectProvider };
