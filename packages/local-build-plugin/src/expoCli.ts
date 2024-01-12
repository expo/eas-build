import spawnAsync, { SpawnOptions, SpawnPromise, SpawnResult } from '@expo/turtle-spawn';

const EXPO_CLI_VERSION = '6.0.5';

export function runGlobalExpoCliCommandAsync(
  expoCliArgs: string[],
  options: SpawnOptions,
  npmVersionAtLeast7: boolean,
): SpawnPromise<SpawnResult> {
  if (process.env.EXPO_CLI_PATH) {
    const expoCliBinPath = process.env.EXPO_CLI_PATH;
    const expoCliCommandWithArgs = expoCliArgs.join(' ');
    options?.logger?.debug(`${expoCliBinPath} ${expoCliCommandWithArgs}`);
    return spawnAsync('bash', ['-c', `${expoCliBinPath} ${expoCliCommandWithArgs}`], options);
  } else {
    const args = [`expo-cli@${EXPO_CLI_VERSION}`, ...expoCliArgs];
    if (npmVersionAtLeast7) {
      // npx shipped with npm >= 7.0.0 requires the "-y" flag to run commands without
      // prompting the user to install a package that is used for the first time
      args.unshift('-y');
    }
    return spawnAsync('npx', args, options);
  }
}
