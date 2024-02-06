import assert from 'assert';

import { Env, Job, Metadata, sanitizeJob, sanitizeMetadata } from '@expo/eas-build-job';
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

export async function runEasBuildInternalAsync<TJob extends Job>({
  job,
  logger,
  env,
  cwd,
}: {
  job: TJob;
  logger: bunyan;
  env: BuildStepEnv;
  cwd: string;
}): Promise<{
  newJob: TJob;
  newMetadata: Metadata;
}> {
  const { cmd, args, extraEnv } = await resolveEasCommandPrefixAndEnvAsync();
  const { buildProfile } = job;
  assert(buildProfile, 'build profile is missing in a build from git-based integration.');
  const result = await spawn(
    cmd,
    [...args, 'build:internal', '--platform', job.platform, '--profile', buildProfile],
    {
      cwd,
      env: {
        ...env,
        EXPO_TOKEN: nullthrows(job.secrets, 'Secrets must be defined for non-custom builds')
          .robotAccessToken,
        ...extraEnv,
      },
      logger,
      mode: PipeMode.STDERR_ONLY_AS_STDOUT,
    }
  );
  const stdout = result.stdout.toString();
  const parsed = JSON.parse(stdout);
  return validateEasBuildInternalResult({
    result: parsed,
    oldJob: job,
  });
}

export async function resolveEnvFromBuildProfileAsync<TJob extends Job>(
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

async function resolveEasCommandPrefixAndEnvAsync(): Promise<{
  cmd: string;
  args: string[];
  extraEnv: Env;
}> {
  const npxArgsPrefix = (await isAtLeastNpm7Async()) ? ['-y'] : [];
  if (process.env.ENVIRONMENT === 'development') {
    return {
      cmd: process.env.EAS_BUILD_INTERNAL_EXECUTABLE ?? `eas`,
      args: [],
      extraEnv: { EXPO_LOCAL: '1' },
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

function validateEasBuildInternalResult<TJob extends Job>({
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
  const newJob = sanitizeJob(value.job) as TJob;
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
