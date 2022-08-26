import os from 'os';
import path from 'path';

import { Ios } from '@expo/eas-build-job';
import fg from 'fast-glob';

import { BuildContext } from '../context';

export async function findXcodeBuildLogsPath(
  ctx: BuildContext<Ios.Job>
): Promise<string | undefined> {
  const customLogPaths = (await fg('*.log', { cwd: ctx.buildLogsDirectory })).map((filename) =>
    path.join(ctx.buildLogsDirectory, filename)
  );
  if (customLogPaths[0]) {
    return customLogPaths[0];
  }
  const fallbackLogPaths = (
    await fg('Library/Logs/gym/*.log', { cwd: os.homedir() })
  ).map((relativePath) => path.join(os.homedir(), relativePath));

  return customLogPaths[0] ?? fallbackLogPaths[0] ?? undefined;
}
