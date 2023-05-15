import { bunyan } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from '../../BuildStepContext.js';
import { BuildRuntimePlatform } from '../../BuildRuntimePlatform.js';

import { createMockLogger } from './logger.js';

interface BuildContextParams {
  buildId?: string;
  logger?: bunyan;
  skipCleanup?: boolean;
  runtimePlatform?: BuildRuntimePlatform;
  workingDirectory?: string;
}

export function createMockContext({
  buildId,
  logger,
  skipCleanup,
  runtimePlatform,
  workingDirectory,
}: BuildContextParams = {}): BuildStepContext {
  return new BuildStepContext(
    buildId ?? uuidv4(),
    logger ?? createMockLogger(),
    skipCleanup ?? false,
    runtimePlatform ?? BuildRuntimePlatform.LINUX,
    workingDirectory
  );
}
