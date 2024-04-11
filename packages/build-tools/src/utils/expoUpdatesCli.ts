import resolveFrom, { silent as silentResolveFrom } from 'resolve-from';
import spawnAsync from '@expo/turtle-spawn';
import { bunyan } from '@expo/logger';

export class ExpoUpdatesCLIModuleNotFoundError extends Error {}
export class ExpoUpdatesCLIInvalidCommandError extends Error {}

export async function expoUpdatesCommandAsync(
  projectDir: string,
  args: string[],
  { logger }: { logger: bunyan }
): Promise<string> {
  let expoUpdatesCli;
  try {
    expoUpdatesCli =
      silentResolveFrom(projectDir, 'expo-updates/bin/cli') ??
      resolveFrom(projectDir, 'expo-updates/bin/cli.js');
  } catch (e: any) {
    if (e.code === 'MODULE_NOT_FOUND') {
      throw new ExpoUpdatesCLIModuleNotFoundError(
        `The \`expo-updates\` package was not found. Follow the installation directions at https://docs.expo.dev/bare/installing-expo-modules/`
      );
    }
    throw e;
  }

  try {
    const spawnResult = await spawnAsync(expoUpdatesCli, args, {
      stdio: 'pipe',
      cwd: projectDir,
      logger,
    });
    return spawnResult.stdout;
  } catch (e: any) {
    if (e.stderr && typeof e.stderr === 'string' && e.stderr.includes('Invalid command')) {
      throw new ExpoUpdatesCLIInvalidCommandError(
        `The command specified by ${args} was not valid in the \`expo-updates\` CLI.`
      );
    }
    throw e;
  }
}
