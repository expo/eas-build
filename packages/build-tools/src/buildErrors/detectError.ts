import { BuildPhase, errors, Ios, Job, Platform } from '@expo/eas-build-job';
import fs from 'fs-extra';

import { findXcodeBuildLogsPathAsync } from '../ios/xcodeBuildLogs';
import { BuildContext } from '../context';

import { ErrorContext, ErrorHandler, XCODE_BUILD_PHASE } from './errors.types';
import { userErrorHandlers } from './userErrorHandlers';
import { buildErrorHandlers } from './buildErrorHandlers';

async function maybeFetchXcodeBuildLogs<TError extends Error, TJob extends Job>(
  handlers: ErrorHandler<TError>[],
  ctx: BuildContext<TJob>
): Promise<string | undefined> {
  if (
    ctx.job.platform !== Platform.IOS ||
    !handlers.map((handler) => handler.phase).includes(XCODE_BUILD_PHASE)
  ) {
    return;
  }

  try {
    const xcodeBuildLogsPath = await findXcodeBuildLogsPathAsync(ctx as BuildContext<Ios.Job>);

    if (!xcodeBuildLogsPath) {
      return;
    }

    const xcodeBuildLogs = await fs.readFile(xcodeBuildLogsPath, 'utf-8');

    return xcodeBuildLogs;
  } catch (err: any) {
    return undefined;
  }
}

async function resolveErrorAsync<TError extends Error, TJob extends Job>(
  errorHandlers: ErrorHandler<TError>[],
  logLines: string[],
  errorContext: ErrorContext,
  ctx: BuildContext<TJob>
): Promise<TError | undefined> {
  const { job, phase } = errorContext;
  const { platform } = job;
  const logs = logLines.join('\n');
  const handlers = errorHandlers
    .filter((handler) => handler.platform === platform || !handler.platform)
    .filter(
      (handler) =>
        (handler.phase === XCODE_BUILD_PHASE && phase === BuildPhase.RUN_FASTLANE) ||
        handler.phase === phase ||
        !handler.phase
    );
  const xcodeBuildLogs = await maybeFetchXcodeBuildLogs(handlers, ctx);

  for (const handler of handlers) {
    const regexp =
      typeof handler.regexp === 'function' ? handler.regexp(errorContext) : handler.regexp;
    if (!regexp) {
      continue;
    }
    const match =
      handler.phase === XCODE_BUILD_PHASE ? xcodeBuildLogs?.match(regexp) : logs.match(regexp);

    if (match) {
      return handler.createError(match, errorContext);
    }
  }
  return undefined;
}

export async function resolveBuildPhaseErrorAsync<TJob extends Job>(
  error: any,
  logLines: string[],
  errorContext: ErrorContext,
  ctx: BuildContext<TJob>
): Promise<errors.BuildError> {
  const { phase } = errorContext;
  if (error instanceof errors.BuildError) {
    return error;
  }
  const userFacingError =
    error instanceof errors.UserFacingError
      ? error
      : (await resolveErrorAsync(userErrorHandlers, logLines, errorContext, ctx)) ??
        new errors.UnknownError();
  const buildError = await resolveErrorAsync(buildErrorHandlers, logLines, errorContext, ctx);

  const isUnknownUserError =
    !userFacingError ||
    ([
      errors.ErrorCode.UNKNOWN_ERROR,
      errors.ErrorCode.UNKNOWN_GRADLE_ERROR,
      errors.ErrorCode.UNKNOWN_FASTLANE_ERROR,
    ] as string[]).includes(userFacingError.errorCode);
  const message =
    (isUnknownUserError ? buildError?.message : userFacingError.message) ?? userFacingError.message;
  const errorCode =
    (isUnknownUserError ? buildError?.errorCode : userFacingError.errorCode) ??
    userFacingError.errorCode;

  return new errors.BuildError(message, {
    errorCode,
    userFacingErrorCode: userFacingError.errorCode,
    userFacingMessage: userFacingError.message,
    docsUrl: userFacingError.docsUrl,
    innerError: error,
    buildPhase: phase,
  });
}
