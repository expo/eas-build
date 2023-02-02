import { bunyan } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from '../../BuildStepContext.js';

import { createMockLogger } from './logger.js';

interface BuildContextParams {
  buildId?: string;
  logger?: bunyan;
  skipCleanup?: boolean;
}

export function createMockContext({
  buildId,
  logger,
  skipCleanup,
}: BuildContextParams = {}): BuildStepContext {
  return new BuildStepContext(
    buildId ?? uuidv4(),
    logger ?? createMockLogger(),
    skipCleanup ?? false
  );
}

export function cloneContextWithOverrides(
  ctx: BuildStepContext,
  { buildId, logger, skipCleanup }: BuildContextParams
): BuildStepContext {
  return new BuildStepContext(
    buildId ?? ctx.buildId,
    logger ?? ctx.logger,
    skipCleanup ?? ctx.skipCleanup
  );
}
