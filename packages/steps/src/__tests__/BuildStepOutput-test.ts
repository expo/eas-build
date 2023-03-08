import { BuildStepOutput } from '../BuildStepOutput.js';
import { BuildStepRuntimeError } from '../errors/BuildStepRuntimeError.js';

import { createMockContext } from './utils/context.js';

describe(BuildStepOutput, () => {
  test('basic case', () => {
    const ctx = createMockContext();
    const o = new BuildStepOutput(ctx, {
      id: 'foo',
      stepId: 'test1',
    });
    o.set('bar');
    expect(o.value).toBe('bar');
  });

  test('stepId is optional (to use with reusable functions)', () => {
    const ctx = createMockContext();
    expect(() => {
      // eslint-disable-next-line no-new
      new BuildStepOutput(ctx, {
        id: 'foo',
      });
    }).not.toThrow();
  });

  test('enforces required policy when reading value', () => {
    const ctx = createMockContext();
    const o = new BuildStepOutput(ctx, { id: 'foo', stepId: 'test1', required: true });
    expect(() => {
      // eslint-disable-next-line
      o.value;
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

  test('.value and .set(value) throw if stepId is not provided', () => {
    const ctx = createMockContext();
    const i = new BuildStepOutput(ctx, {
      id: 'foo',
    });
    expect(() => {
      // eslint-disable-next-line
      i.value;
    }).toThrowError(/\.value can't be used when not in step context/);
    expect(() => {
      i.set('123');
    }).toThrowError(/\.set\('123'\) can't be used when not in step context/);
  });

  test('cloning', () => {
    const ctx = createMockContext();
    const input = new BuildStepOutput(ctx, {
      id: 'foo',
      required: false,
    });
    const clonedInput = input.clone('test1');
    expect(clonedInput.id).toBe('foo');
    expect(clonedInput.stepId).toBe('test1');
    expect(clonedInput.required).toBe(false);
  });
});
