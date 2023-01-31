import fs from 'fs';
import path from 'path';

import { jest } from '@jest/globals';
import { v4 as uuidv4 } from 'uuid';

import { BuildStep } from '../BuildStep.js';
import { BuildStepContext } from '../BuildStepContext.js';

import { createMockLogger } from './utils/logger.js';
import { createMockContext } from './utils/context.js';

describe(BuildStep, () => {
  describe(BuildStep.prototype.executeAsync, () => {
    let buildStepCtx: BuildStepContext;

    beforeEach(async () => {
      buildStepCtx = createMockContext();
      await fs.promises.mkdir(buildStepCtx.workingDirectory, { recursive: true });
    });
    afterEach(async () => {
      await fs.promises.rm(buildStepCtx.workingDirectory, { recursive: true });
    });

    it('executes the command passed to the step', async () => {
      const logger = createMockLogger();

      const lines: string[] = [];
      jest.mocked(logger.info as any).mockImplementation((line: string) => {
        lines.push(line);
      });
      const ctx = new BuildStepContext(uuidv4(), logger, false);

      await Promise.all([
        fs.promises.writeFile(
          path.join(buildStepCtx.workingDirectory, 'expo-abc123'),
          'lorem ipsum'
        ),
        fs.promises.writeFile(
          path.join(buildStepCtx.workingDirectory, 'expo-def456'),
          'lorem ipsum'
        ),
        fs.promises.writeFile(
          path.join(buildStepCtx.workingDirectory, 'expo-ghi789'),
          'lorem ipsum'
        ),
      ]);

      const step = new BuildStep(ctx, {
        id: 'test1',
        command: 'ls -la',
        workingDirectory: buildStepCtx.workingDirectory,
      });
      await step.executeAsync();

      expect(lines.find((line) => line.match('expo-abc123'))).toBeTruthy();
      expect(lines.find((line) => line.match('expo-def456'))).toBeTruthy();
      expect(lines.find((line) => line.match('expo-ghi789'))).toBeTruthy();
    });
  });
});
