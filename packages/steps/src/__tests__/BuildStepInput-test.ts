import { BuildStepRuntimeError } from '../errors/BuildStepRuntimeError.js';
import { BuildStepInput } from '../BuildStepInput.js';

import { createMockContext } from './utils/context.js';

describe(BuildStepInput, () => {
  test('basic case', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepId: 'test1',
    });
    i.set('bar');
    expect(i.value).toBe('bar');
  });

  test('stepId is optional (to use with reusable functions)', () => {
    const ctx = createMockContext();
    expect(() => {
      // eslint-disable-next-line no-new
      new BuildStepInput(ctx, {
        id: 'foo',
      });
    }).not.toThrow();
  });

  test('default value', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepId: 'test1',
      defaultValue: 'baz',
    });
    expect(i.value).toBe('baz');
  });

  test('enforces required policy when reading value', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, { id: 'foo', stepId: 'test1', required: true });
    expect(() => {
      // eslint-disable-next-line
      i.value;
    }).toThrowError(
      new BuildStepRuntimeError(
        'Input parameter "foo" for step "test1" is required but it was not set.'
      )
    );
  });

  test('enforces required policy when setting value', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, { id: 'foo', stepId: 'test1', required: true });
    expect(() => {
      i.set(undefined);
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" is required.')
    );
  });

  test('.value and .set(value) throw if stepId is not provided', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
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
    const input = new BuildStepInput(ctx, {
      id: 'foo',
      defaultValue: 'abc123',
      required: false,
    });
    const clonedInput = input.clone('test1');
    expect(clonedInput.id).toBe('foo');
    expect(clonedInput.stepId).toBe('test1');
    expect(clonedInput.defaultValue).toBe('abc123');
    expect(clonedInput.required).toBe(false);
    expect(clonedInput.value).toBe('abc123');
  });
});
