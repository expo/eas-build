import { BuildStepOutput } from '../BuildStepOutput.js';
import { BuildStepOutputError } from '../errors/BuildStepOutputError.js';

import { createMockContext } from './utils/context.js';

describe(BuildStepOutput, () => {
  test('basic case', () => {
    const ctx = createMockContext();
    const i = new BuildStepOutput(ctx, {
      id: 'foo',
    });
    i.set('bar');
    expect(i.value).toBe('bar');
  });

  test('enforces required policy when reading value', () => {
    const ctx = createMockContext();
    const i = new BuildStepOutput(ctx, { id: 'foo', required: true });
    expect(() => {
      // eslint-disable-next-line
      i.value;
    }).toThrowError(
      new BuildStepOutputError('Output parameter "foo" is required but it was not set.')
    );
  });

  test('enforces required policy when setting value', () => {
    const ctx = createMockContext();
    const i = new BuildStepOutput(ctx, { id: 'foo', required: true });
    expect(() => {
      i.set(undefined);
    }).toThrowError(new BuildStepOutputError('Output parameter "foo" is required.'));
  });
});
