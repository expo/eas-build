import { ExpoConfig } from '@expo/config';
import { Updates } from '@expo/config-plugins';
import { bunyan } from '@expo/logger';

import { ExpoUpdatesCLIModuleNotFoundError, expoUpdatesCommandAsync } from './expoUpdatesCli';
import { isModernExpoUpdatesCLIWithRuntimeVersionCommandSupported } from './expoUpdates';

export async function resolveRuntimeVersionAsync({
  exp,
  platform,
  projectDir,
  logger,
  expoUpdatesPackageVersion,
}: {
  exp: ExpoConfig;
  platform: 'ios' | 'android';
  projectDir: string;
  logger: bunyan;
  expoUpdatesPackageVersion: string;
}): Promise<string | null> {
  if (!isModernExpoUpdatesCLIWithRuntimeVersionCommandSupported(expoUpdatesPackageVersion)) {
    // fall back to the previous behavior (using the @expo/config-plugins eas-cli dependency rather
    // than the versioned @expo/config-plugins dependency in the project)
    return await Updates.getRuntimeVersionNullableAsync(projectDir, exp, platform);
  }

  try {
    const resolvedRuntimeVersionJSONResult = await expoUpdatesCommandAsync(projectDir, [
      'runtimeversion:resolve',
      '--platform',
      platform,
    ]);
    const runtimeVersionResult = JSON.parse(resolvedRuntimeVersionJSONResult);
    if (runtimeVersionResult.fingerprintSources) {
      logger.debug(`Resolved fingeprint runtime version for platform "${platform}". Sources:`);
      logger.debug(runtimeVersionResult.fingerprintSources);
    }
    return runtimeVersionResult.runtimeVersion ?? null;
  } catch (e: any) {
    // if expo-updates is not installed, there's no need for a runtime version in the build
    if (e instanceof ExpoUpdatesCLIModuleNotFoundError) {
      return null;
    }
    throw e;
  }
}
