import os from 'os';

import { BuildStaticContext } from '@expo/eas-build-job';
import { instance, mock, when } from 'ts-mockito';

import { BuildStep } from '../BuildStep.js';
import { BuildStepGlobalContext, BuildStepContext } from '../BuildStepContext.js';
import { BuildStepRuntimeError } from '../errors.js';
import { BuildRuntimePlatform } from '../BuildRuntimePlatform.js';

import { createGlobalContextMock, MockContextProvider } from './utils/context.js';
import { getError } from './utils/error.js';
import { createMockLogger } from './utils/logger.js';

describe(BuildStepGlobalContext, () => {
  describe('stepsInternalBuildDirectory', () => {
    it('is in os.tmpdir()', () => {
      const ctx = new BuildStepGlobalContext(
        new MockContextProvider(
          createMockLogger(),
          BuildRuntimePlatform.LINUX,
          '/non/existent/path',
          '/another/non/existent/path',
          '/working/dir/path',
          '/non/existent/path',
          '/non/existent/path',
          '/non/existent/path',
          {} as unknown as BuildStaticContext
        ),
        false
      );
      expect(ctx.stepsInternalBuildDirectory.startsWith(os.tmpdir())).toBe(true);
    });
  });
  describe('workingDirectory', () => {
    it('if not checked out uses project target dir as default working dir', () => {
      const workingDirectory = '/path/to/working/dir';
      const projectTargetDirectory = '/another/non/existent/path';
      const ctx = new BuildStepGlobalContext(
        new MockContextProvider(
          createMockLogger(),
          BuildRuntimePlatform.LINUX,
          '/non/existent/path',
          projectTargetDirectory,
          workingDirectory,
          '/non/existent/path',
          '/non/existent/path',
          '/non/existent/path',
          {} as unknown as BuildStaticContext
        ),
        false
      );
      expect(ctx.defaultWorkingDirectory).toBe(projectTargetDirectory);
    });

    it('if checked out uses default working dir as default working dir', () => {
      const workingDirectory = '/path/to/working/dir';
      const projectTargetDirectory = '/another/non/existent/path';
      const ctx = new BuildStepGlobalContext(
        new MockContextProvider(
          createMockLogger(),
          BuildRuntimePlatform.LINUX,
          '/non/existent/path',
          projectTargetDirectory,
          workingDirectory,
          '/non/existent/path',
          '/non/existent/path',
          '/non/existent/path',
          {} as unknown as BuildStaticContext
        ),
        false
      );
      ctx.markAsCheckedOut(ctx.baseLogger);
      expect(ctx.defaultWorkingDirectory).toBe(workingDirectory);
    });
  });
  describe(BuildStepGlobalContext.prototype.registerStep, () => {
    it('exists', () => {
      const ctx = createGlobalContextMock();
      expect(typeof ctx.registerStep).toBe('function');
    });
  });
  describe(BuildStepGlobalContext.prototype.serialize, () => {
    it('serializes global context', () => {
      const ctx = createGlobalContextMock({
        skipCleanup: true,
        runtimePlatform: BuildRuntimePlatform.DARWIN,
        projectSourceDirectory: '/a/b/c',
        projectTargetDirectory: '/d/e/f',
        relativeWorkingDirectory: 'i',
        projectRootDirectory: '/a/b/c',
        buildDirectory: '/d/e/f',
        staticContextContent: { a: 1 } as unknown as BuildStaticContext,
      });
      expect(ctx.serialize()).toEqual(
        expect.objectContaining({
          stepsInternalBuildDirectory: ctx.stepsInternalBuildDirectory,
          stepById: {},
          provider: {
            projectSourceDirectory: '/a/b/c',
            projectTargetDirectory: '/d/e/f',
            defaultWorkingDirectory: '/d/e/f/i',
            buildLogsDirectory: '/non/existent/dir',
            projectRootDirectory: '/a/b/c',
            buildDirectory: '/d/e/f',
            runtimePlatform: BuildRuntimePlatform.DARWIN,
            staticContext: { a: 1 },
            env: {},
          },
          skipCleanup: true,
        })
      );
    });
  });
  describe(BuildStepGlobalContext.deserialize, () => {
    it('deserializes global context', () => {
      const ctx = BuildStepGlobalContext.deserialize(
        {
          stepsInternalBuildDirectory: '/m/n/o',
          stepById: {},
          provider: {
            projectSourceDirectory: '/a/b/c',
            projectTargetDirectory: '/d/e/f',
            defaultWorkingDirectory: '/g/h/i',
            buildLogsDirectory: '/j/k/l',
            projectRootDirectory: '/a/b/c',
            buildDirectory: '/d/e/f',
            runtimePlatform: BuildRuntimePlatform.DARWIN,
            staticContext: { a: 1 } as unknown as BuildStaticContext,
            env: {},
          },
          skipCleanup: true,
        },
        createMockLogger()
      );
      ctx.markAsCheckedOut(ctx.baseLogger);
      expect(ctx.stepsInternalBuildDirectory).toBe('/m/n/o');
      expect(ctx.defaultWorkingDirectory).toBe('/g/h/i');
      expect(ctx.runtimePlatform).toBe(BuildRuntimePlatform.DARWIN);
      expect(ctx.skipCleanup).toBe(true);
      expect(ctx.projectSourceDirectory).toBe('/a/b/c');
      expect(ctx.projectTargetDirectory).toBe('/d/e/f');
      expect(ctx.projectRootDirectory).toBe('/a/b/c');
      expect(ctx.buildDirectory).toBe('/d/e/f');
      expect(ctx.buildLogsDirectory).toBe('/j/k/l');
      expect(ctx.staticContext).toEqual({ a: 1 });
      expect(ctx.env).toEqual({});
      expect(ctx.skipCleanup).toBe(true);
    });
  });
  describe(BuildStepGlobalContext.prototype.getStepOutputValue, () => {
    it('throws an error if the step output references a non-existent step', () => {
      const ctx = createGlobalContextMock();
      const error = getError<BuildStepRuntimeError>(() => {
        ctx.getStepOutputValue('steps.abc.def');
      });
      expect(error).toBeInstanceOf(BuildStepRuntimeError);
      expect(error.message).toMatch(/Step "abc" does not exist/);
    });
    it('calls getOutputValueByName on the step to get the output value', () => {
      const ctx = createGlobalContextMock();

      const mockStep = mock<BuildStep>();
      when(mockStep.id).thenReturn('abc');
      when(mockStep.getOutputValueByName('def')).thenReturn('ghi');
      const step = instance(mockStep);

      ctx.registerStep(step);
      expect(ctx.getStepOutputValue('steps.abc.def')).toBe('ghi');
    });
  });
  describe(BuildStepGlobalContext.prototype.stepCtx, () => {
    it('returns a BuildStepContext object', () => {
      const ctx = createGlobalContextMock();
      expect(ctx.stepCtx({ logger: ctx.baseLogger })).toBeInstanceOf(BuildStepContext);
    });
    it('can override logger', () => {
      const logger1 = createMockLogger();
      const logger2 = createMockLogger();
      const ctx = createGlobalContextMock({ logger: logger1 });
      const childCtx = ctx.stepCtx({
        logger: logger2,
      });
      expect(ctx.baseLogger).toBe(logger1);
      expect(childCtx.logger).toBe(logger2);
    });
    it('can override working directory', () => {
      const workingDirectoryOverride = '/d/e/f';
      const ctx = createGlobalContextMock();
      const childCtx = ctx.stepCtx({
        relativeWorkingDirectory: workingDirectoryOverride,
        logger: ctx.baseLogger,
      });
      expect(ctx.defaultWorkingDirectory).not.toBe(childCtx.workingDirectory);
      expect(childCtx.workingDirectory).toBe(workingDirectoryOverride);
    });
  });
});
