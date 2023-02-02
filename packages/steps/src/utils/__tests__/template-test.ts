import { interpolateWithInputs, interpolateWithOutputs } from '../template.js';

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
