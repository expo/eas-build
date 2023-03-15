import { BuildFunction } from '../BuildFunction.js';
import { BuildStep } from '../BuildStep.js';
import { BuildStepInput, BuildStepInputCreator } from '../BuildStepInput.js';
import { BuildStepOutput, BuildStepOutputCreator } from '../BuildStepOutput.js';

import { createMockContext } from './utils/context.js';

describe(BuildFunction, () => {
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
      expect(step.id).toBe('test1');
      expect(step.name).toBe('Test function');
      expect(step.command).toBe('echo 123');
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
    it('creates function input and output parameters', () => {
      const ctx = createMockContext();
      const inputCreators: BuildStepInputCreator[] = [
        (stepId: string) => new BuildStepInput(ctx, { id: 'input1', stepId }),
        (stepId: string) => new BuildStepInput(ctx, { id: 'input2', stepId }),
      ];
      const outputCreators: BuildStepOutputCreator[] = [
        (stepId: string) => new BuildStepOutput(ctx, { id: 'output1', stepId }),
        (stepId: string) => new BuildStepOutput(ctx, { id: 'output2', stepId }),
      ];
      const func = new BuildFunction({
        id: 'test1',
        name: 'Test function',
        command:
          'echo ${ inputs.input1 } ${ inputs.input2 }\nset-output output1 value1\nset-output output2 value2',
        inputCreators,
        outputCreators,
      });
      const step = func.createBuildStepFromFunctionCall(ctx, {
        callInputs: {
          input1: 'abc',
          input2: 'def',
        },
        workingDirectory: ctx.workingDirectory,
      });
      expect(func.inputCreators?.[0]).toBe(inputCreators[0]);
      expect(func.inputCreators?.[1]).toBe(inputCreators[1]);
      expect(func.outputCreators?.[0]).toBe(outputCreators[0]);
      expect(func.outputCreators?.[1]).toBe(outputCreators[1]);
      expect(step.inputs?.[0].id).toBe('input1');
      expect(step.inputs?.[1].id).toBe('input2');
      expect(step.outputs?.[0].id).toBe('output1');
      expect(step.outputs?.[1].id).toBe('output2');
    });
    it('passes values to build inputs', () => {
      const ctx = createMockContext();
      const inputCreators: BuildStepInputCreator[] = [
        (stepId: string) => new BuildStepInput(ctx, { id: 'input1', defaultValue: 'xyz1', stepId }),
        (stepId: string) => new BuildStepInput(ctx, { id: 'input2', defaultValue: 'xyz2', stepId }),
      ];
      const func = new BuildFunction({
        id: 'test1',
        name: 'Test function',
        command: 'echo ${ inputs.input1 } ${ inputs.input2 }',
        inputCreators,
      });
      const step = func.createBuildStepFromFunctionCall(ctx, {
        id: 'buildStep1',
        callInputs: {
          input1: 'abc',
          input2: 'def',
        },
        workingDirectory: ctx.workingDirectory,
      });
      expect(step.inputs?.[0].value).toBe('abc');
      expect(step.inputs?.[1].value).toBe('def');
    });
  });
});
