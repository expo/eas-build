import assert from 'assert';

import { Env, Job, Metadata, sanitizeJob, sanitizeMetadata } from '@expo/eas-build-job';
import { PipeMode } from '@expo/logger';
import spawn from '@expo/turtle-spawn';
import Joi from 'joi';
import nullthrows from 'nullthrows';

import { BuildContext } from '../context';
import { isAtLeastNpm7Async } from '../utils/packageManager';

const EAS_CLI_STAGING_NPM_TAG = 'latest-eas-build-staging';
const EAS_CLI_PRODUCTION_NPM_TAG = 'latest-eas-build';

const EasBuildInternalResultSchema = Joi.object<{ job: object; metadata: object }>({
  job: Joi.object().unknown(),
  metadata: Joi.object().unknown(),
});

export async function runEasBuildInternalAsync<TJob extends Job>(
  ctx: BuildContext<TJob>
): Promise<void> {
  const { cmd, args, extraEnv } = resolveEasCommandPrefixAndEnv(await isAtLeastNpm7Async());
  const { buildProfile } = ctx.job;
  assert(buildProfile, 'build profile is missing in a build from git-based integration.');
  const result = await spawn(
    cmd,
    [...args, 'build:internal', '--platform', ctx.job.platform, '--profile', buildProfile],
    {
      cwd: ctx.reactNativeProjectDirectory,
      env: {
        ...ctx.env,
        EXPO_TOKEN: nullthrows(ctx.job.secrets, 'Secrets must be defined for non-custom builds')
          .robotAccessToken,
        ...extraEnv,
      },
      logger: ctx.logger,
      mode: PipeMode.STDERR_ONLY_AS_STDOUT,
    }
  );
  const stdout = result.stdout.toString();
  const parsed = JSON.parse(stdout);
  const { job, metadata } = validateEasBuildInternalResult(ctx, parsed);
  ctx.updateJobInformation(job, metadata);
}

export async function configureEnvFromBuildProfileAsync<TJob extends Job>(
  ctx: BuildContext<TJob>
): Promise<void> {
  const { cmd, args, extraEnv } = resolveEasCommandPrefixAndEnv(await isAtLeastNpm7Async());
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
        cwd: ctx.reactNativeProjectDirectory,
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
  ctx.updateEnv(env);
}

function resolveEasCommandPrefixAndEnv(isAtLeastNpm7Async: boolean): {
  cmd: string;
  args: string[];
  extraEnv: Env;
} {
  const npxArgsPrefix = isAtLeastNpm7Async ? ['-y'] : [];
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

function validateEasBuildInternalResult<TJob extends Job>(
  ctx: BuildContext<TJob>,
  result: any
): { job: TJob; metadata: Metadata } {
  const { value, error } = EasBuildInternalResultSchema.validate(result, {
    stripUnknown: true,
    convert: true,
    abortEarly: false,
  });
  if (error) {
    throw error;
  }
  const job = sanitizeJob(value.job) as TJob;
  assert(job.platform === ctx.job.platform, 'eas-cli returned a job for a wrong platform');
  const metadata = sanitizeMetadata(value.metadata);
  return { job, metadata };
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
