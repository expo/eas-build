import { JobInterpolationContext } from '@expo/eas-build-job';

import { BuildStepRuntimeError } from '../errors.js';
import { BuildStep } from '../BuildStep.js';
import {
  BuildStepInput,
  BuildStepInputValueTypeName,
  makeBuildStepInputByIdMap,
} from '../BuildStepInput.js';

import { createGlobalContextMock } from './utils/context.js';
import { createMockLogger } from './utils/logger.js';

const emptyInterpolationContext = {} as JobInterpolationContext;

describe(BuildStepInput, () => {
  test('basic case string', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
    });
    i.set('bar');
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toBe('bar');
  });

  test('basic case boolean', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
      required: true,
    });
    i.set(false);
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toBe(false);
  });

  test('basic case number', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
      required: true,
    });
    i.set(42);
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toBe(42);
  });

  test('basic case json', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
      required: true,
    });
    i.set({ foo: 'bar' });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toEqual({ foo: 'bar' });
  });

  test('basic case undefined', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: false,
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
    });
    i.set(undefined);
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toBeUndefined();
  });

  test('default value string', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: 'baz',
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      required: true,
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toBe('baz');
  });

  test('default value boolean', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: true,
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
      required: true,
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toBe(true);
  });

  test('default value json', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: { foo: 'bar' },
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
      required: true,
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toEqual({
      foo: 'bar',
    });
  });

  test('context value string', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.runtimePlatform }',
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toEqual('linux');
  });

  test('context value string with newline characters', () => {
    const ctx = createGlobalContextMock({
      staticContextContent: {
        foo: {
          bar: 'Line 1\nLine 2\n\nLine 3',
        },
      } as unknown as JobInterpolationContext,
    });
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar }',
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toEqual(
      'Line 1\nLine 2\n\nLine 3'
    );
  });

  test('context value string with doubly escaped newline characters', () => {
    const ctx = createGlobalContextMock({
      staticContextContent: {
        foo: {
          bar: 'Line 1\\nLine 2\\n\\nLine 3',
        },
      } as unknown as JobInterpolationContext,
    });
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar }',
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toEqual(
      'Line 1\\nLine 2\\n\\nLine 3'
    );
  });

  it('interpolates correctly', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: false,
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
    });
    i.set('${{ env.MY_ENV_VAR }}');

    const step = new BuildStep(ctx, {
      id: 'test1',
      displayName: 'test1',
      inputs: [i],
      command: '',
      env: {
        MY_ENV_VAR: 'bar',
      },
    });
    expect(i.getValue({ interpolationContext: step.getInterpolationContext() })).toEqual('bar');
  });

  test('context value number', () => {
    const ctx = createGlobalContextMock({
      staticContextContent: {
        foo: {
          bar: [
            1,
            2,
            3,
            {
              baz: 42,
            },
          ],
        },
      } as unknown as JobInterpolationContext,
    });
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar[3].baz }',
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
      required: true,
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toEqual(42);
  });

  test('context value boolean', () => {
    const ctx = createGlobalContextMock({
      staticContextContent: {
        foo: {
          bar: [
            1,
            2,
            3,
            {
              baz: {
                qux: false,
              },
            },
          ],
        },
      } as unknown as JobInterpolationContext,
    });
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar[3].baz.qux }',
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
      required: true,
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toEqual(false);
  });

  test('context value JSON', () => {
    const ctx = createGlobalContextMock({
      staticContextContent: {
        foo: {
          bar: [
            1,
            2,
            3,
            {
              baz: {
                qux: false,
              },
            },
          ],
        },
      } as unknown as JobInterpolationContext,
    });
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo }',
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
      required: true,
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toMatchObject({
      bar: [1, 2, 3, { baz: { qux: false } }],
    });
  });

  test('invalid context value type number', () => {
    const ctx = createGlobalContextMock({
      staticContextContent: {
        foo: {
          bar: [
            1,
            2,
            3,
            {
              baz: {
                qux: 'ala ma kota',
              },
            },
          ],
        },
      } as unknown as JobInterpolationContext,
    });
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar[3].baz.qux }',
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
      required: true,
    });
    expect(() => i.getValue({ interpolationContext: emptyInterpolationContext })).toThrowError(
      'Input parameter "foo" for step "test1" must be of type "number".'
    );
  });

  test('invalid context value type boolean', () => {
    const ctx = createGlobalContextMock({
      staticContextContent: {
        foo: {
          bar: [
            1,
            2,
            3,
            {
              baz: {
                qux: 123,
              },
            },
          ],
        },
      } as unknown as JobInterpolationContext,
    });
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar[3].baz.qux }',
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    expect(() => i.getValue({ interpolationContext: emptyInterpolationContext })).toThrowError(
      'Input parameter "foo" for step "test1" must be of type "boolean".'
    );
  });

  test('invalid context value type JSON', () => {
    const ctx = createGlobalContextMock({
      staticContextContent: {
        foo: {
          bar: [
            1,
            2,
            3,
            {
              baz: {
                qux: 'ala ma kota',
              },
            },
          ],
        },
      } as unknown as JobInterpolationContext,
    });
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar[3].baz.qux }',
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
      required: true,
    });
    expect(() => i.getValue({ interpolationContext: emptyInterpolationContext })).toThrowError(
      'Input parameter "foo" for step "test1" must be of type "json".'
    );
  });

  test('context values in an object', () => {
    const ctx = createGlobalContextMock({
      staticContextContent: {
        context_val_1: 'val_1',
        context_val_2: {
          in_val_1: 'in_val_1',
        },
      } as unknown as JobInterpolationContext,
    });
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
    });
    i.set({
      foo: 'foo',
      bar: '${ eas.context_val_1 }',
      baz: {
        bazfoo: 'bazfoo',
        bazbar: '${ eas.context_val_2.in_val_1 }',
        bazbaz: ['bazbaz', '${ eas.context_val_1 }', '${ eas.context_val_2.in_val_1 }'],
      },
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toEqual({
      foo: 'foo',
      bar: 'val_1',
      baz: {
        bazfoo: 'bazfoo',
        bazbar: 'in_val_1',
        bazbaz: ['bazbaz', 'val_1', 'in_val_1'],
      },
    });
  });

  test('context values in an object with newline characters', () => {
    const ctx = createGlobalContextMock({
      staticContextContent: {
        context_val_1: 'Line 1\nLine 2\n\nLine 3',
      } as unknown as JobInterpolationContext,
    });
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
    });
    i.set({
      foo: 'foo',
      bar: '${ eas.context_val_1 }',
      baz: {
        bazfoo: 'bazfoo',
        bazbaz: ['bazbaz', '${ eas.context_val_1 }'],
      },
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toEqual({
      foo: 'foo',
      bar: 'Line 1\nLine 2\n\nLine 3',
      baz: {
        bazfoo: 'bazfoo',
        bazbaz: ['bazbaz', 'Line 1\nLine 2\n\nLine 3'],
      },
    });
  });

  test('default value number', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: 42,
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
      required: true,
    });
    expect(i.getValue({ interpolationContext: emptyInterpolationContext })).toBe(42);
  });

  test('enforces required policy when reading value', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
    });
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      i.getValue({ interpolationContext: emptyInterpolationContext });
    }).toThrowError(
      new BuildStepRuntimeError(
        'Input parameter "foo" for step "test1" is required but it was not set.'
      )
    );
  });

  test('enforces correct value type when reading a value - basic', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    i.set('bar');
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      i.getValue({ interpolationContext: emptyInterpolationContext });
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" must be of type "boolean".')
    );
  });

  test('enforces correct value type when reading a value - reference json', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      required: true,
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
    });
    i.set('${ eas.runtimePlatform }');
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      i.getValue({ interpolationContext: emptyInterpolationContext });
    }).toThrowError('Input parameter "foo" for step "test1" must be of type "json".');
  });

  test('enforces correct value type when reading a value - reference number', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      required: true,
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
    });
    i.set('${ eas.runtimePlatform }');
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      i.getValue({ interpolationContext: emptyInterpolationContext });
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" must be of type "number".')
    );
  });

  test('enforces correct value type when reading a value - reference boolean', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      required: true,
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    i.set('${ eas.runtimePlatform }');
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      i.getValue({ interpolationContext: emptyInterpolationContext });
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" must be of type "boolean".')
    );
  });

  test('enforces required policy when setting value', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
    });
    expect(() => {
      i.set(undefined);
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" is required.')
    );
  });

  test('serializes correctly', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput<BuildStepInputValueTypeName>(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: 'bar',
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      required: true,
      allowedValues: ['bar', 'baz'],
    });
    i.set('bar');
    expect(i.serialize()).toEqual(
      expect.objectContaining({
        id: 'foo',
        stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
        defaultValue: 'bar',
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        allowedValues: ['bar', 'baz'],
        required: true,
        value: 'bar',
      })
    );
  });

  test('deserializes correctly', () => {
    const ctx = createGlobalContextMock();
    const serializedInput = {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: 'bar',
      allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      allowedValues: ['bar', 'baz'],
      required: true,
      value: 'bar',
      ctx: ctx.serialize(),
    };
    const input = BuildStepInput.deserialize(serializedInput, createMockLogger());
    expect(input).toBeInstanceOf(BuildStepInput);
    expect(input.id).toBe('foo');
    expect(input.stepDisplayName).toBe(BuildStep.getDisplayName({ id: 'test1' }));
    expect(input.defaultValue).toBe('bar');
    expect(input.allowedValueTypeName).toBe(BuildStepInputValueTypeName.STRING);
    expect(input.allowedValues).toEqual(['bar', 'baz']);
    expect(input.required).toBe(true);
    expect(input.getValue({ interpolationContext: emptyInterpolationContext })).toBe('bar');
  });
});

describe(makeBuildStepInputByIdMap, () => {
  it('returns empty object when inputs are undefined', () => {
    expect(makeBuildStepInputByIdMap(undefined)).toEqual({});
  });

  it('returns object with inputs indexed by their ids', () => {
    const ctx = createGlobalContextMock();
    const inputs: BuildStepInput[] = [
      new BuildStepInput(ctx, {
        id: 'foo1',
        stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
        defaultValue: 'bar1',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      new BuildStepInput(ctx, {
        id: 'foo2',
        stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
        defaultValue: 'bar2',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      new BuildStepInput(ctx, {
        id: 'foo3',
        stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
        defaultValue: true,
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
        required: true,
      }),
    ];
    const result = makeBuildStepInputByIdMap(inputs);
    expect(Object.keys(result).length).toBe(3);
    expect(result.foo1).toBeDefined();
    expect(result.foo2).toBeDefined();
    expect(result.foo1.getValue({ interpolationContext: emptyInterpolationContext })).toBe('bar1');
    expect(result.foo2.getValue({ interpolationContext: emptyInterpolationContext })).toBe('bar2');
    expect(result.foo3.getValue({ interpolationContext: emptyInterpolationContext })).toBe(true);
  });
});
