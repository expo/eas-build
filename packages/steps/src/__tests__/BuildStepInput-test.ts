import { BuildStepRuntimeError } from '../errors.js';
import { BuildStep } from '../BuildStep.js';
import {
  BuildStepInput,
  BuildStepInputValueTypeName,
  makeBuildStepInputByIdMap,
} from '../BuildStepInput.js';

import { createGlobalContextMock } from './utils/context.js';

describe(BuildStepInput, () => {
  test('basic case string', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
    });
    i.set('bar');
    expect(i.value).toBe('bar');
  });

  test('basic case boolean', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    i.set(false);
    expect(i.value).toBe(false);
  });

  test('basic case number', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
    });
    i.set(42);
    expect(i.value).toBe(42);
  });

  test('basic case json', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
    });
    i.set({ foo: 'bar' });
    expect(i.value).toEqual({ foo: 'bar' });
  });

  test('basic case undefined', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: false,
    });
    i.set(undefined);
    expect(i.value).toBeUndefined();
  });

  test('default value string', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: 'baz',
    });
    expect(i.value).toBe('baz');
  });

  test('default value boolean', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: true,
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    expect(i.value).toBe(true);
  });

  test('default value json', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: { foo: 'bar' },
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
    });
    expect(i.value).toEqual({ foo: 'bar' });
  });

  test('context value string', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.runtimePlatform }',
    });
    expect(i.value).toEqual('linux');
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
      },
    });
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar[3].baz }',
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
    });
    expect(i.value).toEqual(42);
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
      },
    });
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar[3].baz.qux }',
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    expect(i.value).toEqual(false);
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
      },
    });
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo }',
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
    });
    expect(i.value).toMatchObject({ bar: [1, 2, 3, { baz: { qux: false } }] });
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
      },
    });
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar[3].baz.qux }',
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
    });
    expect(() => i.value).toThrowError(
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
      },
    });
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar[3].baz.qux }',
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    expect(() => i.value).toThrowError(
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
      },
    });
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: '${ eas.foo.bar[3].baz.qux }',
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
    });
    expect(() => i.value).toThrowError(
      'Input parameter "foo" for step "test1" must be of type "json".'
    );
  });

  test('default value number', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      defaultValue: 42,
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
    });
    expect(i.value).toBe(42);
  });

  test('enforces required policy when reading value', () => {
    const ctx = createGlobalContextMock();
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

  test('enforces correct value type when reading a value - basic', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      required: true,
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    i.set('bar');
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      i.value;
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" must be of type "boolean".')
    );
  });

  test('enforces correct value type when reading a value - reference json', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      required: true,
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.JSON,
    });
    i.set('${ eas.runtimePlatform }');
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      i.value;
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" must be of type "json".')
    );
  });

  test('enforces correct value type when reading a value - reference number', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      required: true,
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
    });
    i.set('${ eas.runtimePlatform }');
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      i.value;
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" must be of type "number".')
    );
  });

  test('enforces correct value type when reading a value - reference boolean', () => {
    const ctx = createGlobalContextMock();
    const i = new BuildStepInput(ctx, {
      id: 'foo',
      required: true,
      stepDisplayName: BuildStep.getDisplayName({ id: 'test1' }),
      allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
    });
    i.set('${ eas.runtimePlatform }');
    expect(() => {
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      i.value;
    }).toThrowError(
      new BuildStepRuntimeError('Input parameter "foo" for step "test1" must be of type "boolean".')
    );
  });

  test('enforces required policy when setting value', () => {
    const ctx = createGlobalContextMock();
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
