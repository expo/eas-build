import { BuildStepOutput } from '../BuildStepOutput.js';
import { BuildStepOutputError } from '../errors/BuildStepOutputError.js';

describe(BuildStepOutput, () => {
  test('basic case', () => {
    const i = new BuildStepOutput({
      id: 'foo',
    });
    i.set('bar');
    expect(i.value).toBe('bar');
  });

  test('enforces required policy when reading value', () => {
    const i = new BuildStepOutput({ id: 'foo', required: true });
    expect(() => {
      // eslint-disable-next-line
      i.value;
    }).toThrowError(
      new BuildStepOutputError('Output parameter "foo" is required but it was not set.')
    );
  });

  test('enforces required policy when setting value', () => {
    const i = new BuildStepOutput({ id: 'foo', required: true });
    expect(() => {
      i.set(undefined);
    }).toThrowError(new BuildStepOutputError('Output parameter "foo" is required.'));
  });
});
