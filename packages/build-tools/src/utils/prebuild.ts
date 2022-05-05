import { Job } from '@expo/eas-build-job';
import { SpawnOptions } from '@expo/turtle-spawn';

import { BuildContext } from '../context';

import { installDependencies } from './project';

export interface PrebuildOptions {
  extraEnvs?: Record<string, string>;
}

export async function prebuildAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  options?: PrebuildOptions
): Promise<void> {
  const spawnOptions: SpawnOptions = {
    cwd: ctx.reactNativeProjectDirectory,
    logger: ctx.logger,
    env: {
      ...options?.extraEnvs,
      ...ctx.env,
    },
  };

  await ctx.runExpoCliCommand(getPrebuildCommand(ctx.job), spawnOptions);
  await installDependencies(ctx);
}

function getPrebuildCommand(job: Job): string {
  let prebuildCommand =
    job.experimental?.prebuildCommand ??
    `prebuild --non-interactive --no-install --platform ${job.platform}`;
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
