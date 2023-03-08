import { BuildFunction } from '../BuildFunction.js';
import { BuildStep } from '../BuildStep.js';
import { BuildStepInput } from '../BuildStepInput.js';
import { BuildStepOutput } from '../BuildStepOutput.js';

import { createMockContext } from './utils/context.js';

describe(BuildFunction, () => {
  describe(BuildFunction.prototype.toBuildStep, () => {
    it('returns a BuildStep object', () => {
      const ctx = createMockContext();
      const func = new BuildFunction(ctx, {
        id: 'test1',
        name: 'Test function',
        command: 'echo 123',
      });
      const step = func.toBuildStep({ workingDirectory: ctx.workingDirectory });
      expect(step).toBeInstanceOf(BuildStep);
      expect(step.id).toBe('test1');
      expect(step.name).toBe('Test function');
      expect(step.command).toBe('echo 123');
    });
    it('can override id and shell from function definition', () => {
      const ctx = createMockContext();
      const func = new BuildFunction(ctx, {
        id: 'test1',
        name: 'Test function',
        command: 'echo 123',
        shell: '/bin/bash',
      });
      const step = func.toBuildStep({
        id: 'test2',
        shell: '/bin/zsh',
        workingDirectory: ctx.workingDirectory,
      });
      expect(func.id).toBe('test1');
      expect(func.shell).toBe('/bin/bash');
      expect(step.id).toBe('test2');
      expect(step.shell).toBe('/bin/zsh');
    });
    it('clones function input and output parameters', () => {
      const ctx = createMockContext();
      const funcInputs: BuildStepInput[] = [
        new BuildStepInput(ctx, { id: 'input1' }),
        new BuildStepInput(ctx, { id: 'input2' }),
      ];
      const funcOutputs: BuildStepOutput[] = [
        new BuildStepOutput(ctx, { id: 'output1' }),
        new BuildStepOutput(ctx, { id: 'output2' }),
      ];
      const func = new BuildFunction(ctx, {
        id: 'test1',
        name: 'Test function',
        command:
          'echo ${ inputs.input1 } ${ inputs.input2 }\nset-output output1 value1\nset-output output2 value2',
        inputs: funcInputs,
        outputs: funcOutputs,
      });
      const step = func.toBuildStep({
        callInputs: {
          input1: 'abc',
          input2: 'def',
        },
        workingDirectory: ctx.workingDirectory,
      });
      expect(func.inputs?.[0]).toBe(funcInputs[0]);
      expect(func.inputs?.[1]).toBe(funcInputs[1]);
      expect(func.inputs?.[0].id).toBe('input1');
      expect(func.inputs?.[1].id).toBe('input2');
      expect(func.outputs?.[0]).toBe(funcOutputs[0]);
      expect(func.outputs?.[1]).toBe(funcOutputs[1]);
      expect(func.outputs?.[0].id).toBe('output1');
      expect(func.outputs?.[1].id).toBe('output2');
      expect(step.inputs?.[0]).not.toBe(funcInputs[0]);
      expect(step.inputs?.[1]).not.toBe(funcInputs[1]);
      expect(step.inputs?.[0].id).toBe('input1');
      expect(step.inputs?.[1].id).toBe('input2');
      expect(step.outputs?.[0]).not.toBe(funcOutputs[0]);
      expect(step.outputs?.[1]).not.toBe(funcOutputs[1]);
      expect(step.outputs?.[0].id).toBe('output1');
      expect(step.outputs?.[1].id).toBe('output2');
    });
    it('passes values to build inputs', () => {
      const ctx = createMockContext();
      const funcInputs: BuildStepInput[] = [
        new BuildStepInput(ctx, { id: 'input1', defaultValue: 'xyz1' }),
        new BuildStepInput(ctx, { id: 'input2', defaultValue: 'xyz2' }),
      ];
      const func = new BuildFunction(ctx, {
        id: 'test1',
        name: 'Test function',
        command: 'echo ${ inputs.input1 } ${ inputs.input2 }',
        inputs: funcInputs,
      });
      const step = func.toBuildStep({
        id: 'buildStep1',
        callInputs: {
          input1: 'abc',
          input2: 'def',
        },
        workingDirectory: ctx.workingDirectory,
      });
      expect(func.inputs?.[0].defaultValue).toBe('xyz1');
      expect(func.inputs?.[1].defaultValue).toBe('xyz2');
      expect(step.inputs?.[0].value).toBe('abc');
      expect(step.inputs?.[1].value).toBe('def');
    });
  });
});
