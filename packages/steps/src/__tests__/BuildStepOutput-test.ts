import { BuildStepOutput, makeBuildStepOutputByIdMap } from '../BuildStepOutput.js';
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
});

describe(makeBuildStepOutputByIdMap, () => {
  it('returns empty object when inputs are undefined', () => {
    expect(makeBuildStepOutputByIdMap(undefined)).toEqual({});
  });

  it('returns object with outputs indexed by their ids', () => {
    const ctx = createMockContext();
    const outputs: BuildStepOutput[] = [
      new BuildStepOutput(ctx, { id: 'abc1', stepId: 'test1', required: true }),
      new BuildStepOutput(ctx, { id: 'abc2', stepId: 'test1', required: true }),
    ];
    const result = makeBuildStepOutputByIdMap(outputs);
    expect(Object.keys(result).length).toBe(2);
    expect(result.abc1).toBeDefined();
    expect(result.abc2).toBeDefined();
  });
});
