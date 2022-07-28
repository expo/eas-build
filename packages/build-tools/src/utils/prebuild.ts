import { Job } from '@expo/eas-build-job';
import { SpawnOptions } from '@expo/turtle-spawn';
import semver from 'semver';

import { BuildContext } from '../context';

import { installDependencies, runExpoCliCommand } from './project';

export interface PrebuildOptions {
  extraEnvs?: Record<string, string>;
}

export async function prebuildAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  options?: PrebuildOptions
): Promise<void> {
  const customExpoCliVersion = ctx.job.builderEnvironment?.expoCli;
  const shouldDisableSharp =
    !customExpoCliVersion || semver.satisfies(customExpoCliVersion, '>=5.4.4');

  const spawnOptions: SpawnOptions = {
    cwd: ctx.reactNativeProjectDirectory,
    logger: ctx.logger,
    env: {
      ...(shouldDisableSharp ? { EXPO_IMAGE_UTILS_NO_SHARP: '1' } : {}),
      ...options?.extraEnvs,
      ...ctx.env,
    },
  };

  const prebuildCommandArgs = getPrebuildCommandArgs(ctx.job);
  await runExpoCliCommand(ctx, prebuildCommandArgs, spawnOptions, {
    extraArgsForGlobalExpoCli: ['--non-interactive'],
  });
  await installDependencies(ctx);
}

function getPrebuildCommandArgs(job: Job): string[] {
  let prebuildCommand =
    job.experimental?.prebuildCommand ?? `prebuild --no-install --platform ${job.platform}`;
  if (!prebuildCommand.match(/(?:--platform| -p)/)) {
    prebuildCommand = `${prebuildCommand} --platform ${job.platform}`;
  }
  const npxCommandPrefix = 'npx ';
  const expoCommandPrefix = 'expo ';
  const expoCliCommandPrefix = 'expo-cli ';
  if (prebuildCommand.startsWith(npxCommandPrefix)) {
    prebuildCommand = prebuildCommand.substring(npxCommandPrefix.length).trim();
  }
  if (prebuildCommand.startsWith(expoCommandPrefix)) {
    prebuildCommand = prebuildCommand.substring(expoCommandPrefix.length).trim();
  }
  if (prebuildCommand.startsWith(expoCliCommandPrefix)) {
    prebuildCommand = prebuildCommand.substring(expoCliCommandPrefix.length).trim();
  }
  return prebuildCommand.split(' ');
}
