import path from 'path';

import spawnAsync, { SpawnOptions, SpawnPromise, SpawnResult } from '@expo/turtle-spawn';

const expoCliPackage = require.resolve('expo-cli');

export function runExpoCliCommandAsync(
  command: string,
  options: SpawnOptions
): SpawnPromise<SpawnResult> {
  const expoCliBinPath =
    process.env.EXPO_CLI_PATH ?? path.resolve(path.dirname(expoCliPackage), '../bin/expo.js');
  options?.logger?.debug(`${expoCliBinPath} ${command}`);
  return spawnAsync('bash', ['-c', `${expoCliBinPath} ${command}`], options);
}
