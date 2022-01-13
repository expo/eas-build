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
    const prebuildCommand = this.getPrebuildCommand(job);
    logger.debug(`${expoCliBinPath} ${prebuildCommand}`);
    await spawnAsync('bash', ['-c', `${expoCliBinPath} ${prebuildCommand}`], {
      ...spawnOptions,
      cwd: ctx.reactNativeProjectDirectory,
    });

    await spawnAsync(ctx.packageManager, ['install'], {
      ...spawnOptions,
      cwd: ctx.reactNativeProjectDirectory,
    });
  }

  private getPrebuildCommand(job: Job): string {
    let prebuildCommand =
      job.experimental?.prebuildCommand ?? `prebuild --non-interactive --platform ${job.platform}`;
    if (!prebuildCommand.match(/(?:--platform| -p)/)) {
      prebuildCommand = `${prebuildCommand} --platform ${job.platform}`;
    }
    if (!prebuildCommand.match(/--non-interactive/)) {
      prebuildCommand = `${prebuildCommand} --non-interactive`;
    }
    const npxCommandPrefix = 'npx ';
    const expoCommandPrefix = 'expo ';
    const expoCliCommandPrefix = 'expo-cli ';
    if (prebuildCommand.startsWith(npxCommandPrefix)) {
      prebuildCommand = prebuildCommand.substr(npxCommandPrefix.length).trim();
    }
    if (prebuildCommand.startsWith(expoCommandPrefix)) {
      prebuildCommand = prebuildCommand.substr(expoCommandPrefix.length).trim();
    }
    if (prebuildCommand.startsWith(expoCliCommandPrefix)) {
      prebuildCommand = prebuildCommand.substr(expoCliCommandPrefix.length).trim();
    }
    return prebuildCommand;
  }
}
