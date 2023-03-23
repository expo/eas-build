import assert from 'assert';

import { BuildStep } from '../BuildStep.js';
import { BuildStepInput } from '../BuildStepInput.js';
import { BuildStepOutput } from '../BuildStepOutput.js';
import { BuildWorkflow } from '../BuildWorkflow.js';
import { BuildWorkflowValidator } from '../BuildWorkflowValidator.js';
import { BuildConfigError, BuildWorkflowError } from '../errors.js';

import { createMockContext } from './utils/context.js';
import { getError } from './utils/error.js';

describe(BuildWorkflowValidator, () => {
  test('non unique step ids', async () => {
    const ctx = createMockContext();
    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id: 'test1',
          command: 'echo 123',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test1',
          command: 'echo 456',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test1',
          command: 'echo 789',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test3',
          command: 'echo 123',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test3',
          command: 'echo 456',
          workingDirectory: ctx.workingDirectory,
        }),
      ],
      buildFunctions: {},
    });

    const validator = new BuildWorkflowValidator(workflow);
    const error = getError<BuildWorkflowError>(() => {
      validator.validate();
    });
    expect(error).toBeInstanceOf(BuildWorkflowError);
    assert(error instanceof BuildWorkflowError);
    expect(error.errors.length).toBe(1);
    expect(error.errors[0]).toBeInstanceOf(BuildConfigError);
    expect(error.errors[0].message).toBe('Duplicated step IDs: "test1", "test3"');
  });
  test('output from future step', async () => {
    const ctx = createMockContext();
    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id: 'test1',
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input1',
              stepDisplayId: BuildStep.getDisplayId('test1'),
              required: true,
              defaultValue: '${ steps.test2.output1 }',
            }),
          ],
          command: 'set-output output1 123',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test2',
          outputs: [
            new BuildStepOutput(ctx, {
              id: 'output1',
              stepDisplayId: BuildStep.getDisplayId('test2'),
              required: true,
            }),
          ],
          command: 'echo ${ inputs.input1 }',
          workingDirectory: ctx.workingDirectory,
        }),
      ],
      buildFunctions: {},
    });

    const validator = new BuildWorkflowValidator(workflow);
    const error = getError<BuildWorkflowError>(() => {
      validator.validate();
    });
    expect(error).toBeInstanceOf(BuildWorkflowError);
    assert(error instanceof BuildWorkflowError);
    expect(error.errors.length).toBe(1);
    expect(error.errors[0]).toBeInstanceOf(BuildConfigError);
    expect(error.errors[0].message).toBe(
      'Input parameter "input1" for step with id "test1" uses an expression that references an output parameter from the future step with id "test2".'
    );
  });
  test('output from non-existent step', async () => {
    const ctx = createMockContext();
    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id: 'test2',
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input1',
              stepDisplayId: BuildStep.getDisplayId('test2'),
              required: true,
              defaultValue: '${ steps.test1.output1 }',
            }),
          ],
          command: 'echo ${ inputs.input1 }',
          workingDirectory: ctx.workingDirectory,
        }),
      ],
      buildFunctions: {},
    });

    const validator = new BuildWorkflowValidator(workflow);
    const error = getError<BuildWorkflowError>(() => {
      validator.validate();
    });
    expect(error).toBeInstanceOf(BuildWorkflowError);
    assert(error instanceof BuildWorkflowError);
    expect(error.errors.length).toBe(1);
    expect(error.errors[0]).toBeInstanceOf(BuildConfigError);
    expect(error.errors[0].message).toBe(
      'Input parameter "input1" for step with id "test2" uses an expression that references an output parameter from a non-existent step with id "test1".'
    );
  });
  test('undefined output', async () => {
    const ctx = createMockContext();
    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id: 'test1',
          outputs: [
            new BuildStepOutput(ctx, {
              id: 'output1',
              stepDisplayId: BuildStep.getDisplayId('test1'),
              required: true,
            }),
          ],
          command: 'set-output output1 123',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test2',
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input1',
              stepDisplayId: BuildStep.getDisplayId('test2'),
              required: true,
              defaultValue: '${ steps.test1.output1 }',
            }),
          ],
          command: 'echo ${ inputs.input1 }',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test3',
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input2',
              stepDisplayId: BuildStep.getDisplayId('test3'),
              required: true,
              defaultValue: '${ steps.test2.output2 }',
            }),
          ],
          command: 'echo ${ inputs.input2 }',
          workingDirectory: ctx.workingDirectory,
        }),
      ],
      buildFunctions: {},
    });

    const validator = new BuildWorkflowValidator(workflow);
    const error = getError<BuildWorkflowError>(() => {
      validator.validate();
    });
    expect(error).toBeInstanceOf(BuildWorkflowError);
    assert(error instanceof BuildWorkflowError);
    expect(error.errors.length).toBe(1);
    expect(error.errors[0]).toBeInstanceOf(BuildConfigError);
    expect(error.errors[0].message).toBe(
      'Input parameter "input2" for step with id "test3" uses an expression that references an undefined output parameter "output2" from step with id "test2".'
    );
  });
  test('multiple config errors', () => {
    const ctx = createMockContext();
    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id: 'test1',
          outputs: [
            new BuildStepOutput(ctx, {
              id: 'output1',
              stepDisplayId: BuildStep.getDisplayId('test1'),
              required: true,
            }),
          ],
          command: 'set-output output1 123',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test2',
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input1',
              stepDisplayId: BuildStep.getDisplayId('test2'),
              required: true,
              defaultValue: '${ steps.test4.output1 }',
            }),
          ],
          command: 'echo ${ inputs.input1 }',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test3',
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input2',
              stepDisplayId: BuildStep.getDisplayId('test3'),
              required: true,
              defaultValue: '${ steps.test2.output2 }',
            }),
          ],
          command: 'echo ${ inputs.input2 }',
          workingDirectory: ctx.workingDirectory,
        }),
      ],
      buildFunctions: {},
    });

    const validator = new BuildWorkflowValidator(workflow);
    const error = getError<BuildWorkflowError>(() => {
      validator.validate();
    });
    expect(error).toBeInstanceOf(BuildWorkflowError);
    assert(error instanceof BuildWorkflowError);
    expect(error.errors.length).toBe(2);
    expect(error.errors[0]).toBeInstanceOf(BuildConfigError);
    expect(error.errors[0].message).toBe(
      'Input parameter "input1" for step with id "test2" uses an expression that references an output parameter from a non-existent step with id "test4".'
    );
    expect(error.errors[1]).toBeInstanceOf(BuildConfigError);
    expect(error.errors[1].message).toBe(
      'Input parameter "input2" for step with id "test3" uses an expression that references an undefined output parameter "output2" from step with id "test2".'
    );
  });
});
