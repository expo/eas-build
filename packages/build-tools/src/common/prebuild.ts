import { Job } from '@expo/eas-build-job';
import { SpawnOptions } from '@expo/turtle-spawn';
import semver from 'semver';

import { BuildContext } from '../context';
import { isAtLeastNpm7Async } from '../utils/packageManager';
import { runExpoCliCommand, shouldUseGlobalExpoCli } from '../utils/project';

import { installDependenciesAsync } from './installDependencies';

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

  const prebuildCommandArgs = getPrebuildCommandArgs(ctx);
  await runExpoCliCommand(ctx, prebuildCommandArgs, spawnOptions, {
    npmVersionAtLeast7: await isAtLeastNpm7Async(),
  });
  await installDependenciesAsync(ctx);
}

function getPrebuildCommandArgs<TJob extends Job>(ctx: BuildContext<TJob>): string[] {
  let prebuildCommand =
    ctx.job.experimental?.prebuildCommand ??
    `prebuild --non-interactive --no-install --platform ${ctx.job.platform}`;
  if (!prebuildCommand.match(/(?:--platform| -p)/)) {
    prebuildCommand = `${prebuildCommand} --platform ${ctx.job.platform}`;
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
  if (!shouldUseGlobalExpoCli(ctx)) {
    prebuildCommand = prebuildCommand.replace(' --non-interactive', '');
  }
  return prebuildCommand.split(' ');
}
