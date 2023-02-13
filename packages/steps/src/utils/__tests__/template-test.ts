import { BuildConfigError } from '../../errors/BuildConfigError.js';
import { getError } from '../../__tests__/utils/error.js';
import {
  findOutputPaths,
  interpolateWithInputs,
  interpolateWithOutputs,
  parseOutputPath,
} from '../template.js';

describe(interpolateWithInputs, () => {
  test('interpolation', () => {
    const result = interpolateWithInputs('foo${ inputs.foo }', { foo: 'bar' });
    expect(result).toBe('foobar');
  });
});

describe(interpolateWithOutputs, () => {
  test('interpolation', () => {
    const result = interpolateWithOutputs(
      'foo${ steps.abc123.foo }${ steps.abc123.bar }',
      (path) => {
        if (path === 'abc123.foo') {
          return 'bar';
        } else if (path === 'abc123.bar') {
          return 'baz';
        } else {
          return 'x';
        }
      }
    );
    expect(result).toBe('foobarbaz');
  });
});

describe(findOutputPaths, () => {
  it('returns all occurrences of output expressions in template string', () => {
    const result = findOutputPaths('${ steps.test1.output1 }${steps.test4.output2}');
    expect(result.length).toBe(2);
    expect(result[0]).toMatchObject({
      stepId: 'test1',
      outputId: 'output1',
    });
    expect(result[1]).toMatchObject({
      stepId: 'test4',
      outputId: 'output2',
    });
  });
});

describe(parseOutputPath, () => {
  it('throws an error if path does not consist of exactly two components joined with a dot', () => {
    const error1 = getError<BuildConfigError>(() => {
      parseOutputPath('abc');
    });
    const error2 = getError<BuildConfigError>(() => {
      parseOutputPath('abc.def.ghi');
    });
    expect(error1).toBeInstanceOf(BuildConfigError);
    expect(error1.message).toMatch(/must consist of two components joined with a dot/);
    expect(error2).toBeInstanceOf(BuildConfigError);
    expect(error2.message).toMatch(/must consist of two components joined with a dot/);
  });
  it('returns an object with step ID and output ID', () => {
    const result = parseOutputPath('abc.def');
    expect(result).toMatchObject({
      stepId: 'abc',
      outputId: 'def',
    });
  });
});
