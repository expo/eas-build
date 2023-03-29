import spawn, { SpawnResult } from '@expo/turtle-spawn';
import { BuildPhase, Ios, Job, Platform } from '@expo/eas-build-job';
import { BuildTrigger } from '@expo/eas-build-job/dist/common';

import { BuildContext } from '../context';
import { deleteXcodeEnvLocalIfExistsAsync } from '../ios/xcodeEnv';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { createNpmrcIfNotExistsAsync, logIfNpmrcExistsAsync } from '../utils/npmrc';
import { isAtLeastNpm7Async } from '../utils/packageManager';
import { readPackageJson } from '../utils/project';

import { prepareProjectSourcesAsync } from './projectSources';
import { installDependenciesAsync } from './installDependencies';
import { configureEnvFromBuildProfileAsync, runEasBuildInternalAsync } from './easBuildInternal';

const MAX_EXPO_DOCTOR_TIMEOUT_MS = 20 * 1000;

class DoctorTimeoutError extends Error {}

export async function setupAsync<TJob extends Job>(ctx: BuildContext<TJob>): Promise<void> {
  const packageJson = await ctx.runBuildPhase(BuildPhase.PREPARE_PROJECT, async () => {
    await prepareProjectSourcesAsync(ctx);
    if (ctx.env.NPM_TOKEN) {
      await createNpmrcIfNotExistsAsync(ctx);
    } else {
      await logIfNpmrcExistsAsync(ctx);
    }
    if (ctx.job.platform === Platform.IOS && ctx.env.EAS_BUILD_RUNNER === 'eas-build') {
      await deleteXcodeEnvLocalIfExistsAsync(ctx as BuildContext<Ios.Job>);
    }
    if (ctx.job.triggeredBy === BuildTrigger.GIT_BASED_INTEGRATION) {
      // We need to setup envs from eas.json before
      // eas-build-pre-install hook is called.
      await configureEnvFromBuildProfileAsync(ctx);
    }
    // try to read package.json to see if it exists and is valid
    return readPackageJson(ctx.reactNativeProjectDirectory);
  });

  await ctx.runBuildPhase(BuildPhase.PRE_INSTALL_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_INSTALL);
  });

  await ctx.runBuildPhase(BuildPhase.READ_PACKAGE_JSON, async () => {
    ctx.logger.info('Using package.json:');
    ctx.logger.info(JSON.stringify(packageJson, null, 2));
  });

  await ctx.runBuildPhase(BuildPhase.INSTALL_DEPENDENCIES, async () => {
    await installDependenciesAsync(ctx);
  });

  if (ctx.job.triggeredBy === BuildTrigger.GIT_BASED_INTEGRATION) {
    await ctx.runBuildPhase(BuildPhase.EAS_BUILD_INTERNAL, async () => {
      await runEasBuildInternalAsync(ctx);
    });
  }

  await ctx.runBuildPhase(BuildPhase.READ_APP_CONFIG, async () => {
    ctx.logger.info('Using app configuration:');
    ctx.logger.info(JSON.stringify(ctx.appConfig, null, 2));
  });

  const hasExpoPackage = !!packageJson.dependencies?.expo;
  if (hasExpoPackage) {
    await ctx.runBuildPhase(BuildPhase.RUN_EXPO_DOCTOR, async () => {
      try {
        const { stdout } = await runExpoDoctor(ctx);
        if (!stdout.match(/Didn't find any issues with the project/)) {
          ctx.markBuildPhaseHasWarnings();
        }
      } catch (err) {
        if (err instanceof DoctorTimeoutError) {
          ctx.logger.error(err.message);
        } else {
          ctx.logger.error({ err }, 'Command "expo doctor" failed.');
        }
        ctx.markBuildPhaseHasWarnings();
      }
    });
  }
}

async function runExpoDoctor<TJob extends Job>(ctx: BuildContext<TJob>): Promise<SpawnResult> {
  ctx.logger.info('Running "expo doctor"');
  let timeout: NodeJS.Timeout | undefined;
  let timedOut = false;
  const argsPrefix = (await isAtLeastNpm7Async()) ? ['-y'] : [];
  try {
    const promise = spawn('npx', [...argsPrefix, 'expo-doctor'], {
      cwd: ctx.reactNativeProjectDirectory,
      logger: ctx.logger,
      env: ctx.env,
    });
    timeout = setTimeout(() => {
      timedOut = true;
      promise.child.kill();
      ctx.reportError?.(`"expo doctor" timed out`, undefined, {
        extras: { buildId: ctx.env.EAS_BUILD_ID },
      });
    }, MAX_EXPO_DOCTOR_TIMEOUT_MS);
    return await promise;
  } catch (err: any) {
    if (timedOut) {
      throw new DoctorTimeoutError('"expo doctor" timed out, skipping...');
    }
    throw err;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}
