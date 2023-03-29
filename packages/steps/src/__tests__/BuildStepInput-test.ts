import { BuildStepRuntimeError } from '../errors.js';
import { BuildStep } from '../BuildStep.js';
import { BuildStepInput, makeBuildStepInputByIdMap } from '../BuildStepInput.js';

import { createMockContext } from './utils/context.js';

describe(BuildStepInput, () => {
  test('basic case', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
    });
    i.set('bar');
    expect(i.value).toBe('bar');
  });

  test('default value', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: 'baz',
    });
    expect(i.value).toBe('baz');
  });

  test('enforces required policy when reading value', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: true,
    });
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      i.value;
    }).toThrowError(
      new BuildStepRuntimeError(
        'Input parameter "foo" for step "test1" is required but it was not set.'
      )
    );
  });

  test('enforces required policy when setting value', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: true,
    });
    expect(() => {
      i.set(undefined);
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" is required.')
    );
  });

  test('throws an error if default value is not one of the allowed values', () => {
    const ctx = createMockContext();
    expect(() => {
      // eslint-disable-next-line no-new
      new BuildStepInput(ctx, {
        id: 'foo',
        stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
        allowedValues: ['1', '2', '3'],
        defaultValue: '4',
      });
    }).toThrowError(/is not one of its allowed values/);
  });

  test('setting non-allowed value', () => {
    const ctx = createMockContext();
    const input = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValues: ['1', '2', '3'],
    });
    expect(() => {
      input.set('5');
    }).toThrowError(/is not one of its allowed values/);
  });
});

describe(makeBuildStepInputByIdMap, () => {
  it('returns empty object when inputs are undefined', () => {
    expect(makeBuildStepInputByIdMap(undefined)).toEqual({});
  });

  it('returns object with inputs indexed by their ids', () => {
    const ctx = createMockContext();
    const inputs: BuildStepInput[] = [
      new BuildStepInput(ctx, {
        id: 'foo1',
        stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
        defaultValue: 'bar1',
      }),
      new BuildStepInput(ctx, {
        id: 'foo2',
        stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
        defaultValue: 'bar2',
      }),
    ];
    const result = makeBuildStepInputByIdMap(inputs);
    expect(Object.keys(result).length).toBe(2);
    expect(result.foo1).toBeDefined();
    expect(result.foo2).toBeDefined();
    expect(result.foo1.value).toBe('bar1');
    expect(result.foo2.value).toBe('bar2');
  });
});
