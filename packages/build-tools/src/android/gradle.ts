import path from 'path';
import assert from 'assert';

import spawn, { SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
import { Android, Job } from '@expo/eas-build-job';
import fs from 'fs-extra';
import { bunyan } from '@expo/logger';

import { BuildContext } from '../context';
import { getParentAndDescendantProcessPidsAsync } from '../utils/processes';

export async function ensureLFLineEndingsInGradlewScript<TJob extends Job>(
  ctx: BuildContext<TJob>
): Promise<void> {
  const gradlewPath = path.join(ctx.reactNativeProjectDirectory, 'android', 'gradlew');
  const gradlewContent = await fs.readFile(gradlewPath, 'utf8');
  if (gradlewContent.includes('\r')) {
    ctx.logger.info('Replacing CRLF line endings with LF in gradlew script');
    await fs.writeFile(gradlewPath, gradlewContent.replace(/\r\n/g, '\n'), 'utf8');
  }
}

export async function runGradleCommand(
  ctx: BuildContext<Android.Job>,
  gradleCommand: string
): Promise<void> {
  const androidDir = path.join(ctx.reactNativeProjectDirectory, 'android');
  ctx.logger.info(`Running 'gradlew ${gradleCommand}' in ${androidDir}`);
  const spawnPromise = spawn('bash', ['-c', `sh gradlew ${gradleCommand}`], {
    cwd: androidDir,
    logger: ctx.logger,
    lineTransformer: (line?: string) => {
      if (!line || /^\.+$/.exec(line)) {
        return null;
      } else {
        return line;
      }
    },
    env: ctx.env,
  });
  if (ctx.env.EAS_BUILD_RUNNER === 'eas-build' && process.platform === 'linux') {
    adjustOOMScore(spawnPromise, ctx.logger);
  }

  await spawnPromise;
}

/**
 * OOM Killer sometimes kills worker server while build is exceeding memory limits.
 * `oom_score_adj` is a value between -1000 and 1000 and it defaults to 0.
 * It defines which process is more likely to get killed (higher value more likely).
 *
 * This function sets oom_score_adj for Gradle process and all its child processes.
 */
function adjustOOMScore(spawnPromise: SpawnPromise<SpawnResult>, logger: bunyan): void {
  setTimeout(
    async () => {
      try {
        assert(spawnPromise.child.pid);
        const pids = await getParentAndDescendantProcessPidsAsync(spawnPromise.child.pid);
        await Promise.all(
          pids.map(async (pid: number) => {
            // Value 800 is just a guess here. It's probably higher than most other
            // process. I didn't want to set it any higher, because I'm not sure if OOM Killer
            // can start killing processes when there is still enough memory left.
            const oomScoreOverride = 800;
            await fs.writeFile(`/proc/${pid}/oom_score_adj`, `${oomScoreOverride}\n`);
          })
        );
      } catch (err: any) {
        logger.debug({ err, stderr: err?.stderr }, 'Failed to override oom_score_adj');
      }
    },
    // Wait 20 seconds to make sure all child processes are started
    20000
  );
}
