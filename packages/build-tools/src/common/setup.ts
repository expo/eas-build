import path from 'path';

import spawn, { SpawnPromise, SpawnResult } from '@expo/turtle-spawn';
import fs from 'fs-extra';
import { BuildPhase, Ios, Job, Platform } from '@expo/eas-build-job';
import { BuildTrigger } from '@expo/eas-build-job/dist/common';
import nullthrows from 'nullthrows';
import { ExpoConfig } from '@expo/config';
import { UserFacingError } from '@expo/eas-build-job/dist/errors';

import { BuildContext } from '../context';
import { deleteXcodeEnvLocalIfExistsAsync } from '../ios/xcodeEnv';
import { Hook, runHookIfPresent } from '../utils/hooks';
import { setUpNpmrcAsync } from '../utils/npmrc';
import { isAtLeastNpm7Async } from '../utils/packageManager';
import { readPackageJson, shouldUseGlobalExpoCli } from '../utils/project';
import { getParentAndDescendantProcessPidsAsync } from '../utils/processes';

import { prepareProjectSourcesAsync } from './projectSources';
import { installDependenciesAsync, resolvePackagerDir } from './installDependencies';
import { configureEnvFromBuildProfileAsync, runEasBuildInternalAsync } from './easBuildInternal';

const MAX_EXPO_DOCTOR_TIMEOUT_MS = 30 * 1000;
// const INSTALL_DEPENDENCIES_WARN_TIMEOUT_MS = 15 * 60 * 1000;
const INSTALL_DEPENDENCIES_WARN_TIMEOUT_MS = 10 * 1000;
// const INSTALL_DEPENDENCIES_KILL_TIMEOUT_MS = 30 * 60 * 1000;
const INSTALL_DEPENDENCIES_KILL_TIMEOUT_MS = 30 * 1000;

class DoctorTimeoutError extends Error {}
class InstallDependenciesTimeoutError extends Error {}

export async function setupAsync<TJob extends Job>(ctx: BuildContext<TJob>): Promise<void> {
  const packageJson = await ctx.runBuildPhase(BuildPhase.PREPARE_PROJECT, async () => {
    await prepareProjectSourcesAsync(ctx);
    await setUpNpmrcAsync(ctx, ctx.logger);
    if (ctx.job.platform === Platform.IOS && ctx.env.EAS_BUILD_RUNNER === 'eas-build') {
      await deleteXcodeEnvLocalIfExistsAsync(ctx as BuildContext<Ios.Job>);
    }
    if (ctx.job.triggeredBy === BuildTrigger.GIT_BASED_INTEGRATION) {
      // We need to setup envs from eas.json before
      // eas-build-pre-install hook is called.
      await configureEnvFromBuildProfileAsync(ctx);
    }
    // try to read package.json to see if it exists and is valid
    return readPackageJson(ctx.getReactNativeProjectDirectory());
  });

  await ctx.runBuildPhase(BuildPhase.PRE_INSTALL_HOOK, async () => {
    await runHookIfPresent(ctx, Hook.PRE_INSTALL);
  });

  await ctx.runBuildPhase(BuildPhase.READ_PACKAGE_JSON, async () => {
    ctx.logger.info('Using package.json:');
    ctx.logger.info(JSON.stringify(packageJson, null, 2));
  });

  await ctx.runBuildPhase(BuildPhase.INSTALL_DEPENDENCIES, async () => {
    let killTimeout: NodeJS.Timeout | undefined;
    let killTimedOut: boolean = false;
    const promise = installDependenciesAsync(ctx, {
      logger: ctx.logger,
      workingDir: resolvePackagerDir(ctx),
    });
    const warnTimeout = setTimeout(() => {
      ctx.logger.warn(
        '"Install dependencies" phase takes longer then expected. Consider evaluating your package.json file for possible issues with dependencies'
      );
    }, INSTALL_DEPENDENCIES_WARN_TIMEOUT_MS);
    const killTimeoutPromise = new Promise<void>((res) => {
      killTimeout = setTimeout(() => {
        ctx.logger.error(
          '"Install dependencies" phase takes a very long time. Most likely an unexpected error happened with your dependencies which caused the process to hang and it will be terminated. Please evaluate your package.json file'
        );
        killTimedOut = true;
        ctx.reportError?.('"Install dependencies" phase takes a very long time', undefined, {
          extras: { buildId: ctx.env.EAS_BUILD_ID },
        });
        res();
      }, INSTALL_DEPENDENCIES_KILL_TIMEOUT_MS);
    });
    await Promise.race([promise, killTimeoutPromise]);
    if (warnTimeout) {
      clearTimeout(warnTimeout);
    }
    if (killTimeout) {
      clearTimeout(killTimeout);
    }
    if (killTimedOut) {
      throw new InstallDependenciesTimeoutError(
        '"Install dependencies" phase takes a very long time. Most likely an unexpected error happened with your dependencies which caused the process to hang and it will be terminated. Please evaluate your package.json file'
      );
    }
  });

  if (ctx.job.triggeredBy === BuildTrigger.GIT_BASED_INTEGRATION) {
    await ctx.runBuildPhase(BuildPhase.EAS_BUILD_INTERNAL, async () => {
      await runEasBuildInternalAsync(ctx);
    });
  }

  await ctx.runBuildPhase(BuildPhase.READ_APP_CONFIG, async () => {
    const appConfig = ctx.appConfig;
    ctx.logger.info('Using app configuration:');
    ctx.logger.info(JSON.stringify(appConfig, null, 2));
    await validateAppConfigAsync(ctx, appConfig);
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
  const isAtLeastNpm7 = await isAtLeastNpm7Async();
  try {
    let promise: SpawnPromise<SpawnResult>;
    if (!shouldUseGlobalExpoCli(ctx)) {
      const argsPrefix = isAtLeastNpm7 ? ['-y'] : [];
      promise = spawn('npx', [...argsPrefix, 'expo-doctor'], {
        cwd: ctx.getReactNativeProjectDirectory(),
        logger: ctx.logger,
        env: ctx.env,
      });
    } else {
      promise = ctx.runGlobalExpoCliCommand(
        ['doctor'],
        {
          cwd: ctx.getReactNativeProjectDirectory(),
          logger: ctx.logger,
          env: ctx.env,
        },
        isAtLeastNpm7
      );
    }
    timeout = setTimeout(async () => {
      timedOut = true;
      const ppid = nullthrows(promise.child.pid);
      const pids = await getParentAndDescendantProcessPidsAsync(ppid);
      pids.forEach((pid) => {
        process.kill(pid);
      });
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

async function validateAppConfigAsync(
  ctx: BuildContext<Job>,
  appConfig: ExpoConfig
): Promise<void> {
  if (
    appConfig?.extra?.eas?.projectId &&
    ctx.env.EAS_BUILD_PROJECT_ID &&
    appConfig.extra.eas.projectId !== ctx.env.EAS_BUILD_PROJECT_ID
  ) {
    const isUsingDynamicConfig =
      (await fs.pathExists(path.join(ctx.getReactNativeProjectDirectory(), 'app.config.ts'))) ||
      (await fs.pathExists(path.join(ctx.getReactNativeProjectDirectory(), 'app.config.js')));
    const isGitHubBuild = ctx.job.triggeredBy === BuildTrigger.GIT_BASED_INTEGRATION;
    let extraMessage = '';
    if (isGitHubBuild && isUsingDynamicConfig) {
      extraMessage =
        'Make sure you connected your GitHub repository to the correct Expo project and if you are using environment variables to switch between projects in app.config.js/app.config.ts remember to set those variables in eas.json too. ';
    } else if (isGitHubBuild) {
      extraMessage = 'Make sure you connected your GitHub repository to the correct Expo project. ';
    } else if (isUsingDynamicConfig) {
      extraMessage =
        'If you are using environment variables to switch between projects in app.config.js/app.config.ts, make sure those variables are also set inside EAS Build. You can do that using "env" field in eas.json or EAS Secrets. ';
    }
    throw new UserFacingError(
      'EAS_BUILD_PROJECT_ID_MISMATCH',
      `The value of the "extra.eas.projectId" field (${appConfig.extra.eas.projectId}) in the app config does not match the current project id (${ctx.env.EAS_BUILD_PROJECT_ID}). ${extraMessage}Learn more: https://expo.fyi/eas-config-mismatch.`
    );
  } else if (ctx.env.EAS_BUILD_PROJECT_ID && !appConfig?.extra?.eas?.projectId) {
    ctx.logger.error(`The "extra.eas.projectId" field is missing from your app config.`);
    ctx.markBuildPhaseHasWarnings();
  }
}
