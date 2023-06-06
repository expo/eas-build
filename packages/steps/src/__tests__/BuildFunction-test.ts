import { BuildFunction } from '../BuildFunction.js';
import { BuildStep, BuildStepFunction } from '../BuildStep.js';
import { BuildStepInput, BuildStepInputProvider } from '../BuildStepInput.js';
import { BuildStepOutput, BuildStepOutputProvider } from '../BuildStepOutput.js';

import { createMockContext } from './utils/context.js';
import { UUID_REGEX } from './utils/uuid.js';

describe(BuildFunction, () => {
  describe('constructor', () => {
    it('throws when neither command nor fn is set', () => {
      expect(() => {
        // eslint-disable-next-line no-new
        new BuildFunction({
          id: 'test1',
        });
      }).toThrowError(/Either command or fn must be defined/);
    });

    it('throws when neither command nor fn is set', () => {
      expect(() => {
        // eslint-disable-next-line no-new
        new BuildFunction({
          id: 'test1',
          command: 'echo 123',
          fn: () => {},
        });
      }).toThrowError(/Command and fn cannot be both set/);
    });
  });

  describe(BuildFunction.isFulldIdNamespaced, () => {
    it('returns true for namespaced functions', () => {
      const func = new BuildFunction({
        namespace: 'sokal',
        id: 'dominik',
        fn: () => {},
      });
      const funcFullId = func.getFullId();
      expect(BuildFunction.isFulldIdNamespaced(funcFullId)).toBe(true);
    });
    it('returns false for non-namespaced functions', () => {
      const func = new BuildFunction({
        id: 'dominik',
        fn: () => {},
      });
      const funcFullId = func.getFullId();
      expect(BuildFunction.isFulldIdNamespaced(funcFullId)).toBe(false);
    });
  });

  describe(BuildFunction.prototype.getFullId, () => {
    test('namespace is not defined', () => {
      const buildFunction = new BuildFunction({
        id: 'upload_artifacts',
        name: 'Test function',
        command: 'echo 123',
      });
      expect(buildFunction.getFullId()).toBe('upload_artifacts');
    });
    test('namespace is defined', () => {
      const buildFunction = new BuildFunction({
        namespace: 'eas',
        id: 'upload_artifacts',
        name: 'Test function',
        command: 'echo 123',
      });
      expect(buildFunction.getFullId()).toBe('eas/upload_artifacts');
    });
  });

  describe(BuildFunction.prototype.createBuildStepFromFunctionCall, () => {
    it('returns a BuildStep object', () => {
      const ctx = createMockContext();
      const func = new BuildFunction({
        id: 'test1',
        name: 'Test function',
        command: 'echo 123',
      });
      const step = func.createBuildStepFromFunctionCall(ctx, {
        workingDirectory: ctx.workingDirectory,
      });
      expect(step).toBeInstanceOf(BuildStep);
      expect(step.id).toMatch(UUID_REGEX);
      expect(step.name).toBe('Test function');
      expect(step.command).toBe('echo 123');
    });
    it('works with build step function', () => {
      const ctx = createMockContext();
      const fn: BuildStepFunction = () => {};
      const buildFunction = new BuildFunction({
        id: 'test1',
        name: 'Test function',
        fn,
      });
      const step = buildFunction.createBuildStepFromFunctionCall(ctx, {
        workingDirectory: ctx.workingDirectory,
      });
      expect(step).toBeInstanceOf(BuildStep);
      expect(step.id).toMatch(UUID_REGEX);
      expect(step.name).toBe('Test function');
      expect(step.fn).toBe(fn);
    });
    it('can override id and shell from function definition', () => {
      const ctx = createMockContext();
      const func = new BuildFunction({
        id: 'test1',
        name: 'Test function',
        command: 'echo 123',
        shell: '/bin/bash',
      });
      const step = func.createBuildStepFromFunctionCall(ctx, {
        id: 'test2',
        shell: '/bin/zsh',
        workingDirectory: ctx.workingDirectory,
      });
      expect(func.id).toBe('test1');
      expect(func.shell).toBe('/bin/bash');
      expect(step.id).toBe('test2');
      expect(step.shell).toBe('/bin/zsh');
    });
    it('creates function inputs and outputs', () => {
      const ctx = createMockContext();
      const inputProviders: BuildStepInputProvider[] = [
        BuildStepInput.createProvider({ id: 'input1', defaultValue: true }),
        BuildStepInput.createProvider({ id: 'input2' }),
      ];
      const outputProviders: BuildStepOutputProvider[] = [
        BuildStepOutput.createProvider({ id: 'output1' }),
        BuildStepOutput.createProvider({ id: 'output2' }),
      ];
      const func = new BuildFunction({
        id: 'test1',
        name: 'Test function',
        command:
          'echo ${ inputs.input1 } ${ inputs.input2 }\nset-output output1 value1\nset-output output2 value2',
        inputProviders,
        outputProviders,
      });
      const step = func.createBuildStepFromFunctionCall(ctx, {
        callInputs: {
          input1: 'abc',
          input2: 'def',
        },
        workingDirectory: ctx.workingDirectory,
      });
      expect(func.inputProviders?.[0]).toBe(inputProviders[0]);
      expect(func.inputProviders?.[1]).toBe(inputProviders[1]);
      expect(func.outputProviders?.[0]).toBe(outputProviders[0]);
      expect(func.outputProviders?.[1]).toBe(outputProviders[1]);
      expect(step.inputs?.[0].id).toBe('input1');
      expect(step.inputs?.[1].id).toBe('input2');
      expect(step.outputs?.[0].id).toBe('output1');
      expect(step.outputs?.[1].id).toBe('output2');
    });
    it('passes values to build inputs', () => {
      const ctx = createMockContext();
      const inputProviders: BuildStepInputProvider[] = [
        BuildStepInput.createProvider({ id: 'input1', defaultValue: 'xyz1' }),
        BuildStepInput.createProvider({ id: 'input2', defaultValue: 'xyz2' }),
        BuildStepInput.createProvider({ id: 'input3', defaultValue: 'xyz3' }),
      ];
      const func = new BuildFunction({
        id: 'test1',
        name: 'Test function',
        command: 'echo ${ inputs.input1 } ${ inputs.input2 }',
        inputProviders,
      });
      const step = func.createBuildStepFromFunctionCall(ctx, {
        id: 'buildStep1',
        callInputs: {
          input1: 'abc',
          input2: 'def',
          input3: false,
        },
        workingDirectory: ctx.workingDirectory,
      });
      expect(step.inputs?.[0].value).toBe('abc');
      expect(step.inputs?.[1].value).toBe('def');
      expect(step.inputs?.[2].value).toBe(false);
    });
  });
});
