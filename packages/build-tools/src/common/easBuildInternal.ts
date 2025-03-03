import assert from 'assert';

import { BuildJob, Env, Metadata, sanitizeBuildJob, sanitizeMetadata } from '@expo/eas-build-job';
import { PipeMode, bunyan } from '@expo/logger';
import spawn from '@expo/turtle-spawn';
import Joi from 'joi';
import nullthrows from 'nullthrows';
import { BuildStepEnv } from '@expo/steps';

import { BuildContext } from '../context';
import { isAtLeastNpm7Async } from '../utils/packageManager';

const EAS_CLI_STAGING_NPM_TAG = 'latest-eas-build-staging';
const EAS_CLI_PRODUCTION_NPM_TAG = 'latest-eas-build';

const EasBuildInternalResultSchema = Joi.object<{ job: object; metadata: object }>({
  job: Joi.object().unknown(),
  metadata: Joi.object().unknown(),
});

export async function runEasBuildInternalAsync<TJob extends BuildJob>({
  job,
  logger,
  env,
  cwd,
  projectRootOverride,
}: {
  job: TJob;
  logger: bunyan;
  env: BuildStepEnv;
  cwd: string;
  projectRootOverride?: string;
}): Promise<{
  newJob: TJob;
  newMetadata: Metadata;
}> {
  const { cmd, args, extraEnv } = await resolveEasCommandPrefixAndEnvAsync();
  const { buildProfile, githubTriggerOptions } = job;
  assert(buildProfile, 'build profile is missing in a build from git-based integration.');

  const autoSubmitArgs = [];
  if (githubTriggerOptions?.submitProfile) {
    autoSubmitArgs.push('--auto-submit-with-profile');
    autoSubmitArgs.push(githubTriggerOptions.submitProfile);
  } else if (githubTriggerOptions?.autoSubmit) {
    autoSubmitArgs.push('--auto-submit');
  }

  let result;
  try {
    result = await spawn(
      cmd,
      [
        ...args,
        'build:internal',
        '--platform',
        job.platform,
        '--profile',
        buildProfile,
        ...autoSubmitArgs,
      ],
      {
        cwd,
        env: {
          ...env,
          EXPO_TOKEN: nullthrows(job.secrets, 'Secrets must be defined for non-custom builds')
            .robotAccessToken,
          ...extraEnv,
          EAS_PROJECT_ROOT: projectRootOverride,
        },
        logger,
        mode: PipeMode.STDERR_ONLY_AS_STDOUT,
      }
    );
  } catch (err: any) {
    // Logging of build:internal is weird. We set mode = STDERR_ONLY_AS_STDOUT,
    // because we don't want to pipe stdout to to the logger as it will contain
    // the job object with its secrets. However, if the build fails, stderr alone
    // is often not enough to debug the issue, so we also log stdout in those cases.
    // It will look awkward (first stderr from pipe, then stdout from here), but
    // it's better than nothing.
    logger.error(`${err.stdout}`);
    throw err;
  }

  const stdout = result.stdout.toString();
  const parsed = JSON.parse(stdout);
  return validateEasBuildInternalResult({
    result: parsed,
    oldJob: job,
  });
}

export async function resolveEnvFromBuildProfileAsync<TJob extends BuildJob>(
  ctx: BuildContext<TJob>,
  { cwd }: { cwd: string }
): Promise<Env> {
  const { cmd, args, extraEnv } = await resolveEasCommandPrefixAndEnvAsync();
  const { buildProfile } = ctx.job;
  assert(buildProfile, 'build profile is missing in a build from git-based integration.');
  let spawnResult;
  try {
    spawnResult = await spawn(
      cmd,
      [
        ...args,
        'config',
        '--platform',
        ctx.job.platform,
        '--profile',
        buildProfile,
        '--non-interactive',
        '--json',
        '--eas-json-only',
      ],
      {
        cwd,
        env: { ...ctx.env, ...extraEnv },
      }
    );
  } catch (err: any) {
    ctx.logger.error(`Failed to the read build profile ${buildProfile} from eas.json.`);
    ctx.logger.error(err.stderr?.toString());
    throw Error(`Failed to read the build profile ${buildProfile} from eas.json.`);
  }
  const stdout = spawnResult.stdout.toString();
  const parsed = JSON.parse(stdout);
  const env = validateEnvs(parsed.buildProfile);
  return env;
}

export async function resolveEasCommandPrefixAndEnvAsync(): Promise<{
  cmd: string;
  args: string[];
  extraEnv: Env;
}> {
  const npxArgsPrefix = (await isAtLeastNpm7Async()) ? ['-y'] : [];
  if (process.env.ENVIRONMENT === 'development') {
    return {
      cmd: 'npx',
      args: [...npxArgsPrefix, `eas-cli@${EAS_CLI_STAGING_NPM_TAG}`],
      extraEnv: {},
    };
  } else if (process.env.ENVIRONMENT === 'staging') {
    return {
      cmd: 'npx',
      args: [...npxArgsPrefix, `eas-cli@${EAS_CLI_STAGING_NPM_TAG}`],
      extraEnv: { EXPO_STAGING: '1' },
    };
  } else {
    return {
      cmd: 'npx',
      args: [...npxArgsPrefix, `eas-cli@${EAS_CLI_PRODUCTION_NPM_TAG}`],
      extraEnv: {},
    };
  }
}

function validateEasBuildInternalResult<TJob extends BuildJob>({
  oldJob,
  result,
}: {
  oldJob: TJob;
  result: any;
}): { newJob: TJob; newMetadata: Metadata } {
  const { value, error } = EasBuildInternalResultSchema.validate(result, {
    stripUnknown: true,
    convert: true,
    abortEarly: false,
  });
  if (error) {
    throw error;
  }
  const newJob = sanitizeBuildJob({
    ...value.job,
    // We want to retain values that we have set on the job.
    appId: oldJob.appId,
    initiatingUserId: oldJob.initiatingUserId,
  }) as TJob;
  assert(newJob.platform === oldJob.platform, 'eas-cli returned a job for a wrong platform');
  const newMetadata = sanitizeMetadata(value.metadata);
  return { newJob, newMetadata };
}

function validateEnvs(result: any): Env {
  const { value, error } = Joi.object({
    env: Joi.object().pattern(Joi.string(), Joi.string()),
  }).validate(result, {
    stripUnknown: true,
    convert: true,
    abortEarly: false,
  });
  if (error) {
    throw error;
  }
  return value?.env;
}
