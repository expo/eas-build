import path from 'path';

import { Job } from '@expo/eas-build-job';
import { BuildContext, EjectProvider, EjectOptions } from '@expo/build-tools';
import spawnAsync from '@expo/turtle-spawn';

const expoCliPackage = require.resolve('expo-cli');

export class LocalExpoCliEjectProvider implements EjectProvider<Job> {
  async runEject(ctx: BuildContext<Job>, options?: EjectOptions): Promise<void> {
    const { logger, job } = ctx;

    const spawnOptions = {
      cwd: ctx.buildDirectory,
      logger: ctx.logger,
      env: {
        ...options?.extraEnvs,
        ...ctx.env,
      },
    };

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
