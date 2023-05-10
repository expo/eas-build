import assert from 'assert';

import { BuildStep, BuildStepFunction } from '../BuildStep.js';
import { BuildStepInput } from '../BuildStepInput.js';
import { BuildStepOutput } from '../BuildStepOutput.js';
import { BuildWorkflow } from '../BuildWorkflow.js';
import { BuildWorkflowValidator } from '../BuildWorkflowValidator.js';
import { BuildConfigError, BuildWorkflowError } from '../errors.js';
import { BuildPlatform } from '../BuildPlatform.js';

import { createMockContext } from './utils/context.js';
import { getError } from './utils/error.js';

describe(BuildWorkflowValidator, () => {
  test('non unique step ids', async () => {
    const ctx = createMockContext();
    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id: 'test1',
          displayName: BuildStep.getDisplayName({ id: 'test1', command: 'echo 123' }),
          command: 'echo 123',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test1',
          displayName: BuildStep.getDisplayName({ id: 'test1', command: 'echo 456' }),
          command: 'echo 456',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test1',
          displayName: BuildStep.getDisplayName({ id: 'test1', command: 'echo 789' }),
          command: 'echo 789',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test3',
          displayName: BuildStep.getDisplayName({ id: 'test3', command: 'echo 123' }),
          command: 'echo 123',
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: 'test3',
          displayName: BuildStep.getDisplayName({ id: 'test3', command: 'echo 456' }),
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
  test('input set to a non-allowed value', async () => {
    const ctx = createMockContext();

    const id1 = 'test1';
    const command1 = 'set-output output1 123';
    const displayName1 = BuildStep.getDisplayName({ id: id1, command: command1 });

    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id: id1,
          displayName: displayName1,
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input1',
              stepDisplayName: displayName1,
              required: true,
              defaultValue: '3',
              allowedValues: ['1', '2'],
            }),
          ],
          command: command1,
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
      'Input parameter "input1" for step "test1" is set to "3" which is not one of the allowed values: "1", "2".'
    );
  });
  test('output from future step', async () => {
    const ctx = createMockContext();

    const id1 = 'test1';
    const command1 = 'set-output output1 123';
    const displayName1 = BuildStep.getDisplayName({ id: id1, command: command1 });

    const id2 = 'test2';
    const command2 = 'set-output output1 123';
    const displayName2 = BuildStep.getDisplayName({ id: id2, command: command2 });

    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id: id1,
          displayName: displayName1,
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input1',
              stepDisplayName: displayName1,
              required: true,
              defaultValue: '${ steps.test2.output1 }',
            }),
          ],
          command: command1,
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: id2,
          displayName: displayName2,
          outputs: [
            new BuildStepOutput(ctx, {
              id: 'output1',
              stepDisplayName: displayName2,
              required: true,
            }),
          ],
          command: command2,
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
      'Input parameter "input1" for step "test1" uses an expression that references an output parameter from the future step "test2".'
    );
  });
  test('output from non-existent step', async () => {
    const id = 'test2';
    const command = 'echo ${ inputs.input1 }';
    const displayName = BuildStep.getDisplayName({ id, command });

    const ctx = createMockContext();
    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id,
          displayName,
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input1',
              stepDisplayName: displayName,
              required: true,
              defaultValue: '${ steps.test1.output1 }',
            }),
          ],
          command,
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
      'Input parameter "input1" for step "test2" uses an expression that references an output parameter from a non-existent step "test1".'
    );
  });
  test('undefined output', async () => {
    const id1 = 'test1';
    const command1 = 'set-output output1 123';
    const displayName1 = BuildStep.getDisplayName({ id: id1, command: command1 });

    const id2 = 'test2';
    const command2 = 'echo ${ inputs.input1 }';
    const displayName2 = BuildStep.getDisplayName({ id: id2, command: command2 });

    const id3 = 'test3';
    const command3 = 'echo ${ inputs.input1 }';
    const displayName3 = BuildStep.getDisplayName({ id: id3, command: command3 });

    const ctx = createMockContext();
    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id: id1,
          displayName: displayName1,
          outputs: [
            new BuildStepOutput(ctx, {
              id: 'output1',
              stepDisplayName: displayName1,
              required: true,
            }),
          ],
          command: command1,
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: id2,
          displayName: displayName2,
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input1',
              stepDisplayName: displayName2,
              required: true,
              defaultValue: '${ steps.test1.output1 }',
            }),
          ],
          command: command2,
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: id3,
          displayName: displayName3,
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input2',
              stepDisplayName: displayName3,
              required: true,
              defaultValue: '${ steps.test2.output2 }',
            }),
          ],
          command: command3,
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
      'Input parameter "input2" for step "test3" uses an expression that references an undefined output parameter "output2" from step "test2".'
    );
  });
  test('multiple config errors', () => {
    const id1 = 'test1';
    const command1 = 'set-output output1 123';
    const displayName1 = BuildStep.getDisplayName({ id: id1, command: command1 });

    const id2 = 'test2';
    const command2 = 'echo ${ inputs.input1 }';
    const displayName2 = BuildStep.getDisplayName({ id: id2, command: command2 });

    const id3 = 'test3';
    const command3 = 'echo ${ inputs.input1 }';
    const displayName3 = BuildStep.getDisplayName({ id: id3, command: command3 });

    const ctx = createMockContext();
    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id: id1,
          displayName: displayName1,
          outputs: [
            new BuildStepOutput(ctx, {
              id: 'output1',
              stepDisplayName: displayName1,
              required: true,
            }),
          ],
          command: command1,
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: id2,
          displayName: displayName2,
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input1',
              stepDisplayName: displayName2,
              required: true,
              defaultValue: '${ steps.test4.output1 }',
            }),
          ],
          command: command2,
          workingDirectory: ctx.workingDirectory,
        }),
        new BuildStep(ctx, {
          id: id3,
          displayName: displayName3,
          inputs: [
            new BuildStepInput(ctx, {
              id: 'input2',
              stepDisplayName: displayName3,
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
      'Input parameter "input1" for step "test2" uses an expression that references an output parameter from a non-existent step "test4".'
    );
    expect(error.errors[1]).toBeInstanceOf(BuildConfigError);
    expect(error.errors[1].message).toBe(
      'Input parameter "input2" for step "test3" uses an expression that references an undefined output parameter "output2" from step "test2".'
    );
  });
  test('not allowed platform for build step', async () => {
    const id = 'test';
    const displayName = BuildStep.getDisplayName({ id });
    const fn: BuildStepFunction = () => {};

    const ctx = createMockContext({ platform: BuildPlatform.LINUX });
    const workflow = new BuildWorkflow(ctx, {
      buildSteps: [
        new BuildStep(ctx, {
          id,
          displayName,
          fn,
          workingDirectory: ctx.workingDirectory,
          allowedPlatforms: [BuildPlatform.DARWIN],
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
      `Step "${displayName}" is not allowed on platform "${BuildPlatform.LINUX}". Allowed platforms for this steps are: "${BuildPlatform.DARWIN}".`
    );
  });
});
