import fs from 'fs';
import os from 'os';
import path from 'path';

import { v4 as uuidv4 } from 'uuid';

import { BuildStep } from '../BuildStep.js';
import { BuildStepContext } from '../BuildStepContext.js';

import { createMockLogger } from './utils/logger.js';

describe(BuildStep, () => {
  describe(BuildStep.prototype.executeAsync, () => {
    const workingDirectory = path.join(os.tmpdir(), uuidv4());

    beforeEach(async () => {
      await fs.promises.mkdir(workingDirectory, { recursive: true });
    });
    afterEach(async () => {
      await fs.promises.rm(workingDirectory, { recursive: true });
    });

    it('executes the command passed to the step', async () => {
      const logger = createMockLogger();

      const lines: string[] = [];
      jest.mocked(logger.info).mockImplementation((line) => {
        lines.push(line);
      });
      const ctx = new BuildStepContext(uuidv4(), logger, false);

      await Promise.all([
        fs.promises.writeFile(path.join(workingDirectory, 'expo-abc123'), 'lorem ipsum'),
        fs.promises.writeFile(path.join(workingDirectory, 'expo-def456'), 'lorem ipsum'),
        fs.promises.writeFile(path.join(workingDirectory, 'expo-ghi789'), 'lorem ipsum'),
      ]);

      const step = new BuildStep(ctx, {
        id: 'test1',
        command: 'ls -la',
        workingDirectory,
      });
      await step.executeAsync();

      expect(lines.find((line) => line.match('expo-abc123'))).toBeTruthy();
      expect(lines.find((line) => line.match('expo-def456'))).toBeTruthy();
      expect(lines.find((line) => line.match('expo-ghi789'))).toBeTruthy();
    });
  });
});
