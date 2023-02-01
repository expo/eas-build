import os from 'os';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from '../BuildStepContext.js';

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
});
