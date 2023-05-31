import { bunyan } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from '../../BuildStepContext.js';
import { BuildRuntimePlatform } from '../../BuildRuntimePlatform.js';
import { EasContext } from '../../EasContext.js';

import { createMockLogger } from './logger.js';

interface BuildContextParams {
  buildId?: string;
  logger?: bunyan;
  skipCleanup?: boolean;
  runtimePlatform?: BuildRuntimePlatform;
  projectSourceDirectory?: string;
  projectTargetDirectory?: string;
  easContext?: EasContext;
  workingDirectory?: string;
}

export function createMockContext({
  buildId,
  logger,
  skipCleanup,
  runtimePlatform,
  projectSourceDirectory,
  projectTargetDirectory,
  easContext,
  workingDirectory,
}: BuildContextParams = {}): BuildStepContext {
  return new BuildStepContext(
    buildId ?? uuidv4(),
    logger ?? createMockLogger(),
    skipCleanup ?? false,
    runtimePlatform ?? BuildRuntimePlatform.LINUX,
    projectSourceDirectory ?? '/non/existent/dir',
    projectTargetDirectory ?? '/another/non/existent/dir',
    easContext ?? {},
    workingDirectory
  );
}
