import { BuildPhase, errors, Job, Platform } from '@expo/eas-build-job';
import fs from 'fs-extra';

import { findXcodeBuildLogsPathAsync } from '../ios/xcodeBuildLogs';

import { ErrorContext, ErrorHandler, XCODE_BUILD_PHASE } from './errors.types';
import { userErrorHandlers } from './userErrorHandlers';
import { buildErrorHandlers } from './buildErrorHandlers';

async function maybeReadXcodeBuildLogs<TError extends Error>(
  handlers: ErrorHandler<TError>[],
  job: Job,
  xcodeBuildLogsPath?: string
): Promise<string | undefined> {
  if (
    job.platform !== Platform.IOS ||
    !handlers.map((handler) => handler.phase).includes(XCODE_BUILD_PHASE) ||
    !xcodeBuildLogsPath
  ) {
    return;
  }

  try {
    return await fs.readFile(xcodeBuildLogsPath, 'utf-8');
  } catch (err: any) {
    return undefined;
  }
}

async function resolveErrorAsync<TError extends Error>(
  errorHandlers: ErrorHandler<TError>[],
  logLines: string[],
  errorContext: ErrorContext,
  buildLogsDirectory: string
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

  const xcodeBuildLogsPath = await findXcodeBuildLogsPathAsync(buildLogsDirectory);
  const xcodeBuildLogs = await maybeReadXcodeBuildLogs(handlers, job, xcodeBuildLogsPath);

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

export async function resolveBuildPhaseErrorAsync(
  error: any,
  logLines: string[],
  errorContext: ErrorContext,
  buildLogsDirectory: string
): Promise<errors.BuildError> {
  const { phase } = errorContext;
  if (error instanceof errors.BuildError) {
    return error;
  }
  const userFacingError =
    error instanceof errors.UserFacingError
      ? error
      : (await resolveErrorAsync(userErrorHandlers, logLines, errorContext, buildLogsDirectory)) ??
        new errors.UnknownError();
  const buildError = await resolveErrorAsync(
    buildErrorHandlers,
    logLines,
    errorContext,
    buildLogsDirectory
  );

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
