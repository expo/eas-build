import { Job } from '@expo/eas-build-job';

import { BuildContext } from '../context';

export function createNpmErrorHandler<TJob extends Job>(
  ctx: BuildContext<TJob>
): (err: Error, logLines: string[]) => void {
  return (err: Error, logLines: string[]) => {
    // 1) corrupted npm package
    let matchedTarball: RegExpMatchArray | null = null;
    for (const logLine of logLines) {
      // [stderr] WARN tarball tarball data for @typescript-eslint/typescript-estree@5.26.0 (sha512-cozo/GbwixVR0sgfHItz3t1yXu521yn71Wj6PlYCFA3WPhy51CUPkifFKfBis91bDclGmAY45hhaAXVjdn4new==) seems to be corrupted. Trying again.
      matchedTarball = logLine.match(
        /tarball tarball data for ([^ ]*) .* seems to be corrupted. Trying again/
      );
      if (matchedTarball) {
        break;
      }
    }
    if (matchedTarball) {
      ctx.reportError?.('Corrupted npm package', err, {
        extras: { buildId: ctx.env.EAS_BUILD_ID, logs: logLines.join('\n') },
      });
      return;
    }

    // 2) generic cache error
    if (
      ctx.env.EAS_BUILD_NPM_CACHE_URL &&
      logLines.some((line) => line.includes(ctx.env.EAS_BUILD_NPM_CACHE_URL))
    ) {
      ctx.reportError?.('npm cache error', err, {
        extras: { buildId: ctx.env.EAS_BUILD_ID, logs: logLines.join('\n') },
      });
    }
  };
}
