import { BuildStepOutput } from '../BuildStepOutput.js';
import { BuildStepRuntimeError } from '../errors/BuildStepRuntimeError.js';

import { createMockContext } from './utils/context.js';

describe(BuildStepOutput, () => {
  test('basic case', () => {
    const ctx = createMockContext();
    const i = new BuildStepOutput(ctx, {
      id: 'foo',
      stepId: 'test1',
    });
    i.set('bar');
    expect(i.value).toBe('bar');
  });

  test('enforces required policy when reading value', () => {
    const ctx = createMockContext();
    const i = new BuildStepOutput(ctx, { id: 'foo', stepId: 'test1', required: true });
    expect(() => {
      // eslint-disable-next-line
      i.value;
    }).toThrowError(
      new BuildStepRuntimeError(
        'Output parameter "foo" for step "test1" is required but it was not set.'
      )
    );
  });

  test('enforces required policy when setting value', () => {
    const ctx = createMockContext();
    const i = new BuildStepOutput(ctx, { id: 'foo', stepId: 'test1', required: true });
    expect(() => {
      i.set(undefined);
    }).toThrowError(
      new BuildStepRuntimeError('Output parameter "foo" for step "test1" is required.')
    );
  });
});
