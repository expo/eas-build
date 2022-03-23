import path from 'path';

import spawnAsync, { SpawnOptions } from '@expo/turtle-spawn';

const expoCliPackage = require.resolve('expo-cli');

export async function runExpoCliCommandAsync(
  command: string,
  options: SpawnOptions
): Promise<void> {
  const expoCliBinPath =
    process.env.EXPO_CLI_PATH ?? path.resolve(path.dirname(expoCliPackage), '../bin/expo.js');
  options?.logger?.debug(`${expoCliBinPath} ${command}`);
  await spawnAsync('bash', ['-c', `${expoCliBinPath} ${command}`], options);
}
