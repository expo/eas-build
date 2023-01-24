import os from 'os';
import path from 'path';

import { Ios } from '@expo/eas-build-job';
import fg from 'fast-glob';

import { ArtifactType, BuildContext } from '../context';

export async function findAndUploadXcodeBuildLogsAsync(ctx: BuildContext<Ios.Job>): Promise<void> {
  try {
    const xcodeBuildLogsPath = await findXcodeBuildLogsPathAsync(ctx.buildLogsDirectory);
    if (xcodeBuildLogsPath) {
      await ctx.uploadArtifacts(ArtifactType.XCODE_BUILD_LOGS, [xcodeBuildLogsPath], ctx.logger);
    }
  } catch (err: any) {
    ctx.logger.debug({ err }, 'Failed to upload Xcode build logs');
  }
}

export async function findXcodeBuildLogsPathAsync(
  buildLogsDirectory: string
): Promise<string | undefined> {
  const customLogPaths = (await fg('*.log', { cwd: buildLogsDirectory })).map((filename) =>
    path.join(buildLogsDirectory, filename)
  );
  if (customLogPaths[0]) {
    return customLogPaths[0];
  }
  const fallbackLogPaths = (await fg('Library/Logs/gym/*.log', { cwd: os.homedir() })).map(
    (relativePath) => path.join(os.homedir(), relativePath)
  );

  return customLogPaths[0] ?? fallbackLogPaths[0] ?? undefined;
}
