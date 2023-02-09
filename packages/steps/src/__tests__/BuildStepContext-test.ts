import os from 'os';
import path from 'path';

import { instance, mock, when } from 'ts-mockito';
import { v4 as uuidv4 } from 'uuid';

import { BuildStep } from '../BuildStep.js';
import { BuildStepContext } from '../BuildStepContext.js';
import { BuildStepRuntimeError } from '../errors/BuildStepRuntimeError.js';

import { createMockContext } from './utils/context.js';
import { getError } from './utils/error.js';
import { createMockLogger } from './utils/logger.js';

describe(BuildStepContext, () => {
  describe('baseWorkingDirectory', () => {
    it('is in os.tmpdir()', () => {
      const ctx = new BuildStepContext(uuidv4(), createMockLogger(), false);
      expect(ctx.baseWorkingDirectory.startsWith(os.tmpdir())).toBe(true);
    });
    it('uses the build id as a path component', () => {
      const buildId = uuidv4();
      const ctx = new BuildStepContext(buildId, createMockLogger(), false);
      expect(ctx.baseWorkingDirectory).toMatch(buildId);
    });
  });
  describe('workingDirectory', () => {
    it('defaults to "project" directory in ctx.baseWorkingDirectory', () => {
      const ctx = new BuildStepContext(uuidv4(), createMockLogger(), false);
      expect(ctx.workingDirectory).toBe(path.join(ctx.baseWorkingDirectory, 'project'));
    });
    it('can use the workingDirectory passed to the constructor', () => {
      const workingDirectory = '/path/to/working/dir';
      const ctx = new BuildStepContext(uuidv4(), createMockLogger(), false, workingDirectory);
      expect(ctx.workingDirectory).toBe(workingDirectory);
    });
  });
  describe(BuildStepContext.prototype.registerStep, () => {
    it('exists', () => {
      const ctx = createMockContext();
      expect(typeof ctx.registerStep).toBe('function');
    });
  });
  describe(BuildStepContext.prototype.getStepOutputValue, () => {
    it('throws an error if the step output references a non-existent step', () => {
      const ctx = createMockContext();
      const error = getError<BuildStepRuntimeError>(() => {
        ctx.getStepOutputValue('abc.def');
      });
      expect(error).toBeInstanceOf(BuildStepRuntimeError);
      expect(error.message).toMatch(/Step "abc" does not exist/);
    });
    it('calls getOutputValueByName on the step to get the output value', () => {
      const ctx = createMockContext();

      const mockStep = mock<BuildStep>();
      when(mockStep.id).thenReturn('abc');
      when(mockStep.getOutputValueByName('def')).thenReturn('ghi');
      const step = instance(mockStep);

      ctx.registerStep(step);
      expect(ctx.getStepOutputValue('abc.def')).toBe('ghi');
    });
  });
});
