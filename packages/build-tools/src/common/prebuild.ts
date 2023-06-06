import { Job } from '@expo/eas-build-job';
import { SpawnOptions } from '@expo/turtle-spawn';
import semver from 'semver';
import { bunyan } from '@expo/logger';

import { BuildContext } from '../context';
import { isAtLeastNpm7Async } from '../utils/packageManager';
import { runExpoCliCommand, shouldUseGlobalExpoCli } from '../utils/project';

import { installDependenciesAsync } from './installDependencies';

export interface PrebuildOptions {
  extraEnvs?: Record<string, string>;
  clean?: boolean;
  skipDependencyUpdate?: string;
}

export async function prebuildAsync<TJob extends Job>(
  ctx: BuildContext<TJob>,
  { logger, workingDir, options }: { logger: bunyan; workingDir: string; options?: PrebuildOptions }
): Promise<void> {
  const customExpoCliVersion = ctx.job.builderEnvironment?.expoCli;
  const shouldDisableSharp =
    !customExpoCliVersion || semver.satisfies(customExpoCliVersion, '>=5.4.4');

  const spawnOptions: SpawnOptions = {
    cwd: workingDir,
    logger,
    env: {
      ...(shouldDisableSharp ? { EXPO_IMAGE_UTILS_NO_SHARP: '1' } : {}),
      ...options?.extraEnvs,
      ...ctx.env,
    },
  };

  const prebuildCommandArgs = getPrebuildCommandArgs(ctx, { options });
  await runExpoCliCommand(ctx, prebuildCommandArgs, spawnOptions, {
    npmVersionAtLeast7: await isAtLeastNpm7Async(),
  });
  await installDependenciesAsync(ctx, { logger, workingDir });
}

function getPrebuildCommandArgs<TJob extends Job>(
  ctx: BuildContext<TJob>,
  { options }: { options?: PrebuildOptions }
): string[] {
  let prebuildCommand =
    ctx.job.experimental?.prebuildCommand ??
    `prebuild --non-interactive --no-install --platform ${ctx.job.platform}`;
  if (!prebuildCommand.match(/(?:--platform| -p)/)) {
    prebuildCommand = `${prebuildCommand} --platform ${ctx.job.platform}`;
  }
  if (options?.skipDependencyUpdate) {
    prebuildCommand = `${prebuildCommand} --skip-dependency-update ${options.skipDependencyUpdate}`;
  }
  if (options?.clean) {
    prebuildCommand = `${prebuildCommand} --clean`;
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
