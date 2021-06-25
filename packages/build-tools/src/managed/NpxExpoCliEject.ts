import { Job } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';

import { BuildContext } from '../context';

import { EjectProvider, EjectOptions } from './EjectProvider';

export class NpxExpoCliEjectProvider implements EjectProvider<Job> {
  async runEject(ctx: BuildContext<Job>, options?: EjectOptions): Promise<void> {
    const { logger, job } = ctx;

    const spawnOptions = {
      cwd: ctx.buildDirectory,
      logger,
      env: {
        ...options?.extraEnvs,
        ...ctx.env,
      },
    };

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
