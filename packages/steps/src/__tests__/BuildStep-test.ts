import fs from 'fs/promises';
import path from 'path';

import { jest } from '@jest/globals';
import { instance, mock, verify, when } from 'ts-mockito';
import { v4 as uuidv4 } from 'uuid';

import { BuildStep, BuildStepFunction, BuildStepStatus } from '../BuildStep.js';
import { BuildStepContext } from '../BuildStepContext.js';
import { BuildStepInput } from '../BuildStepInput.js';
import { BuildStepOutput } from '../BuildStepOutput.js';
import { BuildStepRuntimeError } from '../errors.js';
import { nullthrows } from '../utils/nullthrows.js';
import { BuildRuntimePlatform } from '../BuildRuntimePlatform.js';

import { createMockContext } from './utils/context.js';
import { createMockLogger } from './utils/logger.js';
import { getError, getErrorAsync } from './utils/error.js';
import { UUID_REGEX } from './utils/uuid.js';

describe(BuildStep, () => {
  describe(BuildStep.getNewId, () => {
    it('returns a uuid if the user-defined id is undefined', () => {
      expect(BuildStep.getNewId()).toMatch(UUID_REGEX);
    });
    it('returns the user-defined id if defined', () => {
      expect(BuildStep.getNewId('test1')).toBe('test1');
    });
  });

  describe(BuildStep.getDisplayName, () => {
    it('returns the name if defined', () => {
      expect(BuildStep.getDisplayName({ id: 'test1', name: 'Step 1' })).toBe('Step 1');
    });
    it("returns the id if it's not a uuid", () => {
      expect(BuildStep.getDisplayName({ id: 'test1' })).toBe('test1');
    });
    it('returns the first line of the command if name is undefined and id is a uuid', () => {
      expect(BuildStep.getDisplayName({ id: uuidv4(), command: 'echo 123\necho 456' })).toBe(
        'echo 123'
      );
    });
    it('returns the first non-comment line of the command', async () => {
      expect(
        BuildStep.getDisplayName({ id: uuidv4(), command: '# list files\nls -la\necho 123' })
      ).toBe('ls -la');
    });
    it('returns the uuid id if neither name nor command is defined', () => {
      const id = uuidv4();
      expect(BuildStep.getDisplayName({ id })).toBe(id);
    });
  });

  describe('constructor', () => {
    it('throws when neither command nor fn is set', () => {
      const mockCtx = mock<BuildStepContext>();
      when(mockCtx.logger).thenReturn(createMockLogger());
      const ctx = instance(mockCtx);
      expect(() => {
        const id = 'test1';
        // eslint-disable-next-line no-new
        new BuildStep(ctx, {
          id,
          displayName: BuildStep.getDisplayName({ id }),
          workingDirectory: '/tmp',
        });
      }).toThrowError(/Either command or fn must be defined/);
    });

    it('throws when neither command nor fn is set', () => {
      const mockCtx = mock<BuildStepContext>();
      when(mockCtx.logger).thenReturn(createMockLogger());
      const ctx = instance(mockCtx);
      expect(() => {
        const id = 'test1';
        const command = 'echo 123';
        const displayName = BuildStep.getDisplayName({ id, command });

        // eslint-disable-next-line no-new
        new BuildStep(ctx, {
          id,
          displayName,
          workingDirectory: '/tmp',
          command,
          fn: () => {},
        });
      }).toThrowError(/Command and fn cannot be both set/);
    });

    it('calls ctx.registerStep with the new object', () => {
      const mockCtx = mock<BuildStepContext>();
      when(mockCtx.logger).thenReturn(createMockLogger());
      const ctx = instance(mockCtx);

      const id = 'test1';
      const command = 'ls -la';
      const displayName = BuildStep.getDisplayName({ id, command });

      const step = new BuildStep(ctx, {
        id,
        displayName,
        command,
        workingDirectory: '/tmp',
      });
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      verify(mockCtx.registerStep(step)).called();
    });

    it('sets the status to NEW', () => {
      const ctx = createMockContext();

      const id = 'test1';
      const command = 'ls -la';
      const displayName = BuildStep.getDisplayName({ id, command });

      const step = new BuildStep(ctx, {
        id,
        displayName,
        command,
        workingDirectory: '/tmp',
      });
      expect(step.status).toBe(BuildStepStatus.NEW);
    });

    it('creates child build context', () => {
      const ctx = createMockContext();

      const id = 'test1';
      const command = 'ls -la';
      const displayName = BuildStep.getDisplayName({ id, command });

      const step = new BuildStep(ctx, {
        id,
        displayName,
        command,
      });
      expect(step.ctx).toBeInstanceOf(BuildStepContext);
      expect(step.ctx).not.toBe(ctx);
    });

    it('creates child build context with correct changed working directory', () => {
      const ctx = createMockContext({ workingDirectory: '/a/b/c' });

      const id = 'test1';
      const command = 'ls -la';
      const displayName = BuildStep.getDisplayName({ id, command });

      const step = new BuildStep(ctx, {
        id,
        displayName,
        command,
        workingDirectory: 'd/e/f',
      });
      expect(step.ctx.workingDirectory).toBe('/a/b/c/d/e/f');
    });

    it('creates child build context with unchanged working directory', () => {
      const ctx = createMockContext({ workingDirectory: '/a/b/c' });

      const id = 'test1';
      const command = 'ls -la';
      const displayName = BuildStep.getDisplayName({ id, command });

      const step = new BuildStep(ctx, {
        id,
        command,
        displayName,
      });
      expect(step.ctx.workingDirectory).toBe('/a/b/c');
    });

    it('creates child build context with child logger', () => {
      const ctx = createMockContext();

      const id = 'test1';
      const name = 'Test step';
      const command = 'ls -la';
      const displayName = BuildStep.getDisplayName({ id, name, command });

      const step = new BuildStep(ctx, {
        id,
        name,
        displayName,
        command,
      });
      expect(ctx.logger.child).toHaveBeenCalledWith(
        expect.objectContaining({
          buildStepInternalId: expect.stringMatching(UUID_REGEX),
          buildStepId: 'test1',
          buildStepDisplayName: 'Test step',
        })
      );
      expect(step.ctx.logger).not.toBe(ctx.logger);
    });
  });

  describe(BuildStep.prototype.executeAsync, () => {
    let baseStepCtx: BuildStepContext;

    beforeEach(async () => {
      baseStepCtx = createMockContext();
      await fs.mkdir(baseStepCtx.workingDirectory, { recursive: true });
    });
    afterEach(async () => {
      await fs.rm(baseStepCtx.stepsInternalBuildDirectory, { recursive: true });
    });

    it('sets status to FAIL when step fails', async () => {
      const id = 'test1';
      const command = 'false';
      const displayName = BuildStep.getDisplayName({ id, command });

      const step = new BuildStep(baseStepCtx, {
        id,
        command,
        displayName,
        workingDirectory: baseStepCtx.workingDirectory,
      });
      await expect(step.executeAsync()).rejects.toThrow();
      expect(step.status).toBe(BuildStepStatus.FAIL);
    });

    it('sets status to SUCCESS when step succeeds', async () => {
      const id = 'test1';
      const command = 'true';
      const displayName = BuildStep.getDisplayName({ id, command });

      const step = new BuildStep(baseStepCtx, {
        id,
        displayName,
        command,
        workingDirectory: baseStepCtx.workingDirectory,
      });
      await step.executeAsync();
      expect(step.status).toBe(BuildStepStatus.SUCCESS);
    });

    describe('command', () => {
      it('executes the command passed to the step', async () => {
        const logger = createMockLogger();
        const lines: string[] = [];
        jest
          .mocked(logger.info as any)
          .mockImplementation((obj: object | string, line?: string) => {
            if (typeof obj === 'string') {
              lines.push(obj);
            } else if (line) {
              lines.push(line);
            }
          });
        jest.mocked(logger.child).mockReturnValue(logger);
        const ctx = baseStepCtx.child({ logger });

        await Promise.all([
          fs.writeFile(path.join(ctx.workingDirectory, 'expo-abc123'), 'lorem ipsum'),
          fs.writeFile(path.join(ctx.workingDirectory, 'expo-def456'), 'lorem ipsum'),
          fs.writeFile(path.join(ctx.workingDirectory, 'expo-ghi789'), 'lorem ipsum'),
        ]);

        const id = 'test1';
        const command = 'ls -la';
        const displayName = BuildStep.getDisplayName({ id, command });

        const step = new BuildStep(ctx, {
          id,
          command,
          displayName,
          workingDirectory: ctx.workingDirectory,
        });
        await step.executeAsync();

        expect(lines.find((line) => line.match('expo-abc123'))).toBeTruthy();
        expect(lines.find((line) => line.match('expo-def456'))).toBeTruthy();
        expect(lines.find((line) => line.match('expo-ghi789'))).toBeTruthy();
      });

      it('interpolates the inputs in command template', async () => {
        const id = 'test1';
        const command = 'set-output foo2 ${ inputs.foo1 }';
        const displayName = BuildStep.getDisplayName({ id, command });

        const step = new BuildStep(baseStepCtx, {
          id,
          displayName,
          inputs: [
            new BuildStepInput(baseStepCtx, {
              id: 'foo1',
              stepDisplayName: displayName,
              defaultValue: 'bar',
            }),
          ],
          outputs: [
            new BuildStepOutput(baseStepCtx, {
              id: 'foo2',
              stepDisplayName: displayName,
              required: true,
            }),
          ],
          command,
          workingDirectory: baseStepCtx.workingDirectory,
        });
        await step.executeAsync();
        expect(step.getOutputValueByName('foo2')).toBe('bar');
      });

      it('collects the outputs after calling the script', async () => {
        const id = 'test1';
        const command = 'set-output abc 123';
        const displayName = BuildStep.getDisplayName({ id, command });

        const step = new BuildStep(baseStepCtx, {
          id,
          displayName,
          outputs: [
            new BuildStepOutput(baseStepCtx, {
              id: 'abc',
              stepDisplayName: displayName,
            }),
          ],
          command,
          workingDirectory: baseStepCtx.workingDirectory,
        });
        await step.executeAsync();
        const abc = nullthrows(step.outputs).find((output) => output.id === 'abc');
        expect(abc?.value).toBe('123');
      });

      it('works with strings with whitespaces passed as a value for an output parameter', async () => {
        const id = 'test1';
        const command = 'set-output abc "d o m i n i k"';
        const displayName = BuildStep.getDisplayName({ id, command });

        const step = new BuildStep(baseStepCtx, {
          id,
          displayName,
          outputs: [
            new BuildStepOutput(baseStepCtx, {
              id: 'abc',
              stepDisplayName: displayName,
            }),
          ],
          command,
          workingDirectory: baseStepCtx.workingDirectory,
        });
        await step.executeAsync();
        const abc = nullthrows(step.outputs).find((output) => output.id === 'abc');
        expect(abc?.value).toBe('d o m i n i k');
      });

      it('prints a warning if some of the outputs set with set-output are not defined in step config', async () => {
        const logger = createMockLogger();
        const warnLines: string[] = [];
        jest.mocked(logger.warn as any).mockImplementation((line: string) => {
          warnLines.push(line);
        });
        jest.mocked(logger.child).mockReturnValue(logger);
        const ctx = baseStepCtx.child({ logger });

        const id = 'test1';
        const command = 'set-output abc 123';
        const displayName = BuildStep.getDisplayName({ id, command });

        const step = new BuildStep(ctx, {
          id,
          command,
          displayName,
          workingDirectory: ctx.workingDirectory,
        });
        await step.executeAsync();
        const found = warnLines.find((l) => l.match(/Some outputs are not defined in step config/));
        expect(found).not.toBeUndefined();
      });

      it('throws an error if some required outputs have not been set with set-output in script', async () => {
        const id = 'test1';
        const command = 'echo 123';
        const displayName = BuildStep.getDisplayName({ id, command });

        const step = new BuildStep(baseStepCtx, {
          id,
          displayName,
          outputs: [
            new BuildStepOutput(baseStepCtx, {
              id: 'abc',
              stepDisplayName: displayName,
              required: true,
            }),
          ],
          command,
          workingDirectory: baseStepCtx.workingDirectory,
        });
        const error = await getErrorAsync<BuildStepRuntimeError>(async () => step.executeAsync());
        expect(error).toBeInstanceOf(BuildStepRuntimeError);
        expect(error.message).toMatch(/Some required outputs have not been set: "abc"/);
      });
    });

    describe('fn', () => {
      it('executes the function passed to the step', async () => {
        const fnMock = jest.fn();
        const env = { TEST1: 'abc' };

        const id = 'test1';
        const displayName = BuildStep.getDisplayName({ id });

        const step = new BuildStep(baseStepCtx, {
          id,
          displayName,
          fn: fnMock,
          workingDirectory: baseStepCtx.workingDirectory,
        });

        await step.executeAsync(env);

        expect(fnMock).toHaveBeenCalledWith(
          step.ctx,
          expect.objectContaining({ inputs: expect.any(Object), outputs: expect.any(Object), env })
        );
      });

      it('passes input and outputs to the function', async () => {
        const env = { TEST_VAR_1: 'abc' };

        const id = 'test1';
        const displayName = BuildStep.getDisplayName({ id });

        const inputs: BuildStepInput[] = [
          new BuildStepInput(baseStepCtx, {
            id: 'foo1',
            stepDisplayName: displayName,
            defaultValue: 'bar1',
          }),
          new BuildStepInput(baseStepCtx, {
            id: 'foo2',
            stepDisplayName: displayName,
            defaultValue: 'bar2',
          }),
        ];
        const outputs: BuildStepOutput[] = [
          new BuildStepOutput(baseStepCtx, {
            id: 'abc',
            stepDisplayName: displayName,
            required: true,
          }),
        ];

        const fn: BuildStepFunction = (_ctx, { inputs, outputs }) => {
          outputs.abc.set(`${inputs.foo1.value} ${inputs.foo2.value}`);
        };

        const step = new BuildStep(baseStepCtx, {
          id,
          displayName,
          inputs,
          outputs,
          fn,
          workingDirectory: baseStepCtx.workingDirectory,
        });

        await step.executeAsync(env);

        expect(step.getOutputValueByName('abc')).toBe('bar1 bar2');
      });
    });
  });

  describe(BuildStep.prototype.getOutputValueByName, () => {
    let baseStepCtx: BuildStepContext;

    beforeEach(async () => {
      baseStepCtx = createMockContext();
      await fs.mkdir(baseStepCtx.workingDirectory, { recursive: true });
    });
    afterEach(async () => {
      await fs.rm(baseStepCtx.stepsInternalBuildDirectory, { recursive: true });
    });

    it('throws an error when the step has not been executed yet', async () => {
      const id = 'test1';
      const command = 'set-output abc 123';
      const displayName = BuildStep.getDisplayName({ id, command });

      const step = new BuildStep(baseStepCtx, {
        id,
        displayName,
        outputs: [
          new BuildStepOutput(baseStepCtx, {
            id: 'abc',
            stepDisplayName: displayName,
            required: true,
          }),
        ],
        command,
        workingDirectory: baseStepCtx.workingDirectory,
      });
      const error = getError<BuildStepRuntimeError>(() => {
        step.getOutputValueByName('abc');
      });
      expect(error).toBeInstanceOf(BuildStepRuntimeError);
      expect(error.message).toMatch(/The step has not been executed yet/);
    });

    it('throws an error when trying to access a non-existent output', async () => {
      const id = 'test1';
      const command = 'set-output abc 123';
      const displayName = BuildStep.getDisplayName({ id, command });

      const step = new BuildStep(baseStepCtx, {
        id,
        displayName,
        outputs: [
          new BuildStepOutput(baseStepCtx, {
            id: 'abc',
            stepDisplayName: displayName,
            required: true,
          }),
        ],
        command,
        workingDirectory: baseStepCtx.workingDirectory,
      });
      await step.executeAsync();
      const error = getError<BuildStepRuntimeError>(() => {
        step.getOutputValueByName('def');
      });
      expect(error).toBeInstanceOf(BuildStepRuntimeError);
      expect(error.message).toMatch(/Step "test1" does not have output "def"/);
    });

    it('returns the output value', async () => {
      const id = 'test1';
      const command = 'set-output abc 123';
      const displayName = BuildStep.getDisplayName({ id, command });

      const step = new BuildStep(baseStepCtx, {
        id,
        displayName,
        outputs: [
          new BuildStepOutput(baseStepCtx, {
            id: 'abc',
            stepDisplayName: displayName,
            required: true,
          }),
        ],
        command,
        workingDirectory: baseStepCtx.workingDirectory,
      });
      await step.executeAsync();
      expect(step.getOutputValueByName('abc')).toBe('123');
    });

    it('propagates environment variables to the script', async () => {
      const logger = createMockLogger();
      const lines: string[] = [];
      jest.mocked(logger.info as any).mockImplementation((obj: object | string, line?: string) => {
        if (typeof obj === 'string') {
          lines.push(obj);
        } else if (line) {
          lines.push(line);
        }
      });
      jest.mocked(logger.child).mockReturnValue(logger);

      const id = 'test1';
      const command = 'echo $TEST_ABC';
      const displayName = BuildStep.getDisplayName({ id, command });

      const ctx = baseStepCtx.child({ logger });
      const step = new BuildStep(ctx, {
        id,
        displayName,
        command,
        workingDirectory: ctx.workingDirectory,
      });
      await step.executeAsync({ TEST_ABC: 'lorem ipsum' });
      expect(lines.find((line) => line.match('lorem ipsum'))).toBeTruthy();
    });

    it('executes the command with internal environment variables', async () => {
      const logger = createMockLogger();
      const lines: string[] = [];
      jest.mocked(logger.info as any).mockImplementation((obj: object | string, line?: string) => {
        if (typeof obj === 'string') {
          lines.push(obj);
        } else if (line) {
          lines.push(line);
        }
      });
      jest.mocked(logger.child).mockReturnValue(logger);

      const id = 'test1';
      const command =
        'echo $__EXPO_STEPS_BUILD_ID\necho $__EXPO_STEPS_OUTPUTS_DIR\necho $__EXPO_STEPS_WORKING_DIRECTORY';
      const displayName = BuildStep.getDisplayName({ id, command });

      const ctx = baseStepCtx.child({ logger });
      const step = new BuildStep(ctx, {
        id,
        displayName,
        command,
        workingDirectory: ctx.workingDirectory,
      });
      await step.executeAsync();
      expect(lines.find((line) => line.match(ctx.buildId))).toBeTruthy();
      expect(
        lines.find((line) =>
          line.startsWith(path.join(ctx.stepsInternalBuildDirectory, 'steps/test1/outputs'))
        )
      ).toBeTruthy();
      expect(lines.find((line) => line.match(ctx.workingDirectory))).toBeTruthy();
    });
  });
});

describe(BuildStep.prototype.canBeRunOnRuntimePlatform, () => {
  let baseStepCtx: BuildStepContext;

  beforeEach(async () => {
    baseStepCtx = createMockContext({ runtimePlatform: BuildRuntimePlatform.LINUX });
    await fs.mkdir(baseStepCtx.workingDirectory, { recursive: true });
  });
  afterEach(async () => {
    await fs.rm(baseStepCtx.stepsInternalBuildDirectory, { recursive: true });
  });

  it('returns true when the step does not have a platform filter', async () => {
    const id = 'test1';
    const command = 'set-output abc 123';
    const displayName = BuildStep.getDisplayName({ id, command });

    const step = new BuildStep(baseStepCtx, {
      id,
      displayName,
      command,
      workingDirectory: baseStepCtx.workingDirectory,
    });
    expect(step.canBeRunOnRuntimePlatform()).toBe(true);
  });

  it('returns true when the step has a platform filter and the platform matches', async () => {
    const id = 'test1';
    const command = 'set-output abc 123';
    const displayName = BuildStep.getDisplayName({ id, command });

    const step = new BuildStep(baseStepCtx, {
      id,
      displayName,
      supportedRuntimePlatforms: [BuildRuntimePlatform.DARWIN, BuildRuntimePlatform.LINUX],
      command,
      workingDirectory: baseStepCtx.workingDirectory,
    });
    expect(step.canBeRunOnRuntimePlatform()).toBe(true);
  });

  it('returns false when the step has a platform filter and the platform does not match', async () => {
    const id = 'test1';
    const command = 'set-output abc 123';
    const displayName = BuildStep.getDisplayName({ id, command });

    const step = new BuildStep(baseStepCtx, {
      id,
      displayName,
      supportedRuntimePlatforms: [BuildRuntimePlatform.DARWIN],
      command,
      workingDirectory: baseStepCtx.workingDirectory,
    });
    expect(step.canBeRunOnRuntimePlatform()).toBe(false);
  });
});
