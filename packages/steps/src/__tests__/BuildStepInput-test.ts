import { BuildStepRuntimeError } from '../errors.js';
import { BuildStep } from '../BuildStep.js';
import {
  BuildStepInput,
  BuildStepInputValueTypeName,
  makeBuildStepInputByIdMap,
} from '../BuildStepInput.js';

import { createMockContext } from './utils/context.js';

describe(BuildStepInput, () => {
  test('basic case string', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
    });
    i.set('bar');
    expect(i.value).toBe('bar');
  });

  test('basic case boolean', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    i.set(false);
    expect(i.value).toBe(false);
  });

  test('basic case number', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
    });
    i.set(42);
    expect(i.value).toBe(42);
  });

  test('basic case undefined', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: false,
    });
    i.set(undefined);
    expect(i.value).toBeUndefined();
  });

  test('default value string', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: 'baz',
    });
    expect(i.value).toBe('baz');
  });

  test('default value boolean', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: true,
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    expect(i.value).toBe(true);
  });

  test('default value number', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: 42,
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
    });
    expect(i.value).toBe(42);
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

  test('enforces allowed value type policy when setting value', () => {
    const ctx = createMockContext();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    expect(() => {
      i.set('bar');
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" must be of type "boolean".')
    );
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
      new BuildStepInput(ctx, {
        id: 'foo3',
        stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
        defaultValue: true,
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
      }),
    ];
    const result = makeBuildStepInputByIdMap(inputs);
    expect(Object.keys(result).length).toBe(3);
    expect(result.foo1).toBeDefined();
    expect(result.foo2).toBeDefined();
    expect(result.foo1.value).toBe('bar1');
    expect(result.foo2.value).toBe('bar2');
    expect(result.foo3.value).toBe(true);
  });
});
