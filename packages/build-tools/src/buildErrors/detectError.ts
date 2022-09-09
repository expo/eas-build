import { errors } from '@expo/eas-build-job';

import { ErrorContext, ErrorHandler } from './errors.types';
import { userErrorHandlers } from './userErrorHandlers';
import { buildErrorHandlers } from './buildErrorHandlers';

function resolveError<T extends Error>(
  errorHandlers: ErrorHandler<T>[],
  logLines: string[],
  errorContext: ErrorContext
): T | undefined {
  const { job, phase } = errorContext;
  const { platform } = job;
  const logs = logLines.join('\n');
  const handlers = errorHandlers
    .filter((handler) => handler.platform === platform || !handler.platform)
    .filter((handler) => handler.phase === phase || !handler.phase);
  for (const handler of handlers) {
    const regexp =
      typeof handler.regexp === 'function' ? handler.regexp(errorContext) : handler.regexp;
    if (!regexp) {
      continue;
    }
    const match = logs.match(regexp);
    if (match) {
      return handler.createError(match, errorContext);
    }
  }
  return undefined;
}

export function resolveBuildPhaseError(
  error: any,
  logLines: string[],
  errorContext: ErrorContext
): errors.BuildError {
  const { phase } = errorContext;
  if (error instanceof errors.BuildError) {
    return error;
  }
  const userFacingError =
    error instanceof errors.UserFacingError
      ? error
      : resolveError(userErrorHandlers, logLines, errorContext) ?? new errors.UnknownError();
  const buildError = resolveError(buildErrorHandlers, logLines, errorContext);

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
