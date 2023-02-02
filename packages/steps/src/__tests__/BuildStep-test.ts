import fs from 'fs';
import path from 'path';

import { jest } from '@jest/globals';
import { instance, mock, verify, when } from 'ts-mockito';

import { BuildStep, BuildStepStatus } from '../BuildStep.js';
import { BuildStepContext } from '../BuildStepContext.js';
import { BuildStepInput } from '../BuildStepInput.js';
import { BuildStepOutput } from '../BuildStepOutput.js';
import { BuildConfigError } from '../errors/BuildConfigError.js';
import { BuildStepRuntimeError } from '../errors/BuildStepRuntimeError.js';
import { nullthrows } from '../utils/nullthrows.js';

import { createMockContext, cloneContextWithOverrides } from './utils/context.js';
import { createMockLogger } from './utils/logger.js';
import { getError, getErrorAsync } from './utils/error.js';

describe(BuildStep, () => {
  describe('constructor', () => {
    it('calls ctx.registerStep with the new object', () => {
      const mockCtx = mock<BuildStepContext>();
      when(mockCtx.logger).thenReturn(createMockLogger());
      const ctx = instance(mockCtx);
      const step = new BuildStep(ctx, {
        id: 'test1',
        command: 'ls -la',
        workingDirectory: '/tmp',
      });
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      verify(mockCtx.registerStep(step)).called();
    });
    it('sets the status to NEW', () => {
      const ctx = createMockContext();
      const step = new BuildStep(ctx, {
        id: 'test1',
        command: 'ls -la',
        workingDirectory: '/tmp',
      });
      expect(step.status).toBe(BuildStepStatus.NEW);
    });
  });

  describe(BuildStep.prototype.executeAsync, () => {
    let baseStepCtx: BuildStepContext;

    beforeEach(async () => {
      baseStepCtx = createMockContext();
      await fs.promises.mkdir(baseStepCtx.workingDirectory, { recursive: true });
    });
    afterEach(async () => {
      await fs.promises.rm(baseStepCtx.baseWorkingDirectory, { recursive: true });
    });

    it('executes the command passed to the step', async () => {
      const logger = createMockLogger();
      const lines: string[] = [];
      jest.mocked(logger.info as any).mockImplementation((line: string) => {
        lines.push(line);
      });
      const ctx = cloneContextWithOverrides(baseStepCtx, { logger });

      await Promise.all([
        fs.promises.writeFile(path.join(ctx.workingDirectory, 'expo-abc123'), 'lorem ipsum'),
        fs.promises.writeFile(path.join(ctx.workingDirectory, 'expo-def456'), 'lorem ipsum'),
        fs.promises.writeFile(path.join(ctx.workingDirectory, 'expo-ghi789'), 'lorem ipsum'),
      ]);

      const step = new BuildStep(ctx, {
        id: 'test1',
        command: 'ls -la',
        workingDirectory: ctx.workingDirectory,
      });
      await step.executeAsync();

      expect(lines.find((line) => line.match('expo-abc123'))).toBeTruthy();
      expect(lines.find((line) => line.match('expo-def456'))).toBeTruthy();
      expect(lines.find((line) => line.match('expo-ghi789'))).toBeTruthy();
    });

    it('interpolates the input parameters in command template', async () => {
      const step = new BuildStep(baseStepCtx, {
        id: 'test1',
        inputs: [new BuildStepInput(baseStepCtx, { id: 'foo1', defaultValue: 'bar' })],
        outputs: [new BuildStepOutput(baseStepCtx, { id: 'foo2', required: true })],
        command: 'set-output foo2 ${ inputs.foo1 }',
        workingDirectory: baseStepCtx.workingDirectory,
      });
      await step.executeAsync();
      expect(step.getOutputValueByName('foo2')).toBe('bar');
    });

    it('collects the output parameters after calling the script', async () => {
      const step = new BuildStep(baseStepCtx, {
        id: 'test1',
        outputs: [new BuildStepOutput(baseStepCtx, { id: 'abc' })],
        command: 'set-output abc 123',
        workingDirectory: baseStepCtx.workingDirectory,
      });
      await step.executeAsync();
      const abc = nullthrows(step.outputs).find((output) => output.id === 'abc');
      expect(abc?.value).toBe('123');
    });

    it('prints a warning if some of the output parameters set with set-output are not defined in step config', async () => {
      const logger = createMockLogger();
      const warnLines: string[] = [];
      jest.mocked(logger.warn as any).mockImplementation((line: string) => {
        warnLines.push(line);
      });
      const ctx = cloneContextWithOverrides(baseStepCtx, { logger });

      const step = new BuildStep(ctx, {
        id: 'test1',
        command: 'set-output abc 123',
        workingDirectory: ctx.workingDirectory,
      });
      await step.executeAsync();
      const found = warnLines.find((l) => l.match(/Some outputs are not defined in step config/));
      expect(found).not.toBeUndefined();
    });

    it('throws an error if some required output parameters have not been set with set-output in script', async () => {
      const step = new BuildStep(baseStepCtx, {
        id: 'test1',
        outputs: [new BuildStepOutput(baseStepCtx, { id: 'abc', required: true })],
        command: 'echo 123',
        workingDirectory: baseStepCtx.workingDirectory,
      });
      const error = await getErrorAsync<BuildStepRuntimeError>(async () => step.executeAsync());
      expect(error).toBeInstanceOf(BuildStepRuntimeError);
      expect(error.message).toMatch(/Some required output parameters have not been set: "abc"/);
    });

    it('sets status to FAILED when command fails', async () => {
      const step = new BuildStep(baseStepCtx, {
        id: 'test1',
        command: 'false',
        workingDirectory: baseStepCtx.workingDirectory,
      });
      await expect(step.executeAsync()).rejects.toThrow();
      expect(step.status).toBe(BuildStepStatus.FAILED);
    });

    it('sets status to SUCCEEDED when command succeeds', async () => {
      const step = new BuildStep(baseStepCtx, {
        id: 'test1',
        command: 'true',
        workingDirectory: baseStepCtx.workingDirectory,
      });
      await step.executeAsync();
      expect(step.status).toBe(BuildStepStatus.SUCCEEDED);
    });
  });

  describe(BuildStep.prototype.getOutputValueByName, () => {
    let baseStepCtx: BuildStepContext;

    beforeEach(async () => {
      baseStepCtx = createMockContext();
      await fs.promises.mkdir(baseStepCtx.workingDirectory, { recursive: true });
    });
    afterEach(async () => {
      await fs.promises.rm(baseStepCtx.baseWorkingDirectory, { recursive: true });
    });

    it('throws an error when the step has not been executed yet', async () => {
      const step = new BuildStep(baseStepCtx, {
        id: 'test1',
        outputs: [new BuildStepOutput(baseStepCtx, { id: 'abc', required: true })],
        command: 'set-output abc 123',
        workingDirectory: baseStepCtx.workingDirectory,
      });
      const error = getError<BuildStepRuntimeError>(() => {
        step.getOutputValueByName('abc');
      });
      expect(error).toBeInstanceOf(BuildStepRuntimeError);
      expect(error.message).toMatch(/The step has not been executed yet/);
    });

    it('throws an error when trying to access a non-existent output', async () => {
      const step = new BuildStep(baseStepCtx, {
        id: 'test1',
        outputs: [new BuildStepOutput(baseStepCtx, { id: 'abc', required: true })],
        command: 'set-output abc 123',
        workingDirectory: baseStepCtx.workingDirectory,
      });
      await step.executeAsync();
      const error = getError<BuildConfigError>(() => {
        step.getOutputValueByName('def');
      });
      expect(error).toBeInstanceOf(BuildConfigError);
      expect(error.message).toMatch(/Step "test1" does not have output "def"/);
    });

    it('returns the output value', async () => {
      const step = new BuildStep(baseStepCtx, {
        id: 'test1',
        outputs: [new BuildStepOutput(baseStepCtx, { id: 'abc', required: true })],
        command: 'set-output abc 123',
        workingDirectory: baseStepCtx.workingDirectory,
      });
      await step.executeAsync();
      expect(step.getOutputValueByName('abc')).toBe('123');
    });
  });
});
