import path from 'path';
import os from 'os';

import { bunyan } from '@expo/logger';
import { v4 as uuidv4 } from 'uuid';
import {
  BuildRuntimePlatform,
  BuildStepContext,
  BuildStepEnv,
  BuildStepGlobalContext,
  ExternalBuildContextProvider,
} from '@expo/steps';

import { createMockLogger } from './logger';

export class MockContextProvider implements ExternalBuildContextProvider {
  private _env: BuildStepEnv = {};

  constructor(
    public readonly logger: bunyan,
    public readonly runtimePlatform: BuildRuntimePlatform,
    public readonly projectSourceDirectory: string,
    public readonly projectTargetDirectory: string,
    public readonly defaultWorkingDirectory: string,
    public readonly buildLogsDirectory: string,
    public readonly staticContextContent: Record<string, any> = {}
  ) {}
  public get env(): BuildStepEnv {
    return this._env;
  }
  public staticContext(): any {
    return { ...this.staticContextContent };
  }
  public updateEnv(env: BuildStepEnv): void {
    this._env = env;
  }
}

interface BuildContextParams {
  buildId?: string;
  logger?: bunyan;
  skipCleanup?: boolean;
  runtimePlatform?: BuildRuntimePlatform;
  projectSourceDirectory?: string;
  projectTargetDirectory?: string;
  relativeWorkingDirectory?: string;
  staticContextContent?: Record<string, any>;
}

export function createStepContextMock({
  buildId,
  logger,
  skipCleanup,
  runtimePlatform,
  projectSourceDirectory,
  projectTargetDirectory,
  relativeWorkingDirectory,
  staticContextContent,
}: BuildContextParams = {}): BuildStepContext {
  const globalCtx = createGlobalContextMock({
    buildId,
    logger,
    skipCleanup,
    runtimePlatform,
    projectSourceDirectory,
    projectTargetDirectory,
    relativeWorkingDirectory,
    staticContextContent,
  });
  return new BuildStepContext(globalCtx, {
    logger: logger ?? createMockLogger(),
    relativeWorkingDirectory,
  });
}

export function createGlobalContextMock({
  logger,
  skipCleanup,
  runtimePlatform,
  projectSourceDirectory,
  projectTargetDirectory,
  relativeWorkingDirectory,
  staticContextContent,
}: BuildContextParams = {}): BuildStepGlobalContext {
  const resolvedProjectTargetDirectory =
    projectTargetDirectory ?? path.join(os.tmpdir(), 'eas-build', uuidv4());
  return new BuildStepGlobalContext(
    new MockContextProvider(
      logger ?? createMockLogger(),
      runtimePlatform ?? BuildRuntimePlatform.LINUX,
      projectSourceDirectory ?? '/non/existent/dir',
      resolvedProjectTargetDirectory,
      relativeWorkingDirectory
        ? path.resolve(resolvedProjectTargetDirectory, relativeWorkingDirectory)
        : resolvedProjectTargetDirectory,
      '/non/existent/dir',
      staticContextContent ?? {}
    ),
    skipCleanup ?? false
  );
}
