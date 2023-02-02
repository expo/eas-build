import { BuildStepInputError } from '../errors/BuildStepInputError.js';
import { BuildStepInput } from '../BuildStepInput.js';

describe(BuildStepInput, () => {
  test('basic case', () => {
    const i = new BuildStepInput({
      id: 'foo',
    });
    i.set('bar');
    expect(i.value).toBe('bar');
  });

  test('default value', () => {
    const i = new BuildStepInput({
      id: 'foo',
      defaultValue: 'baz',
    });
    expect(i.value).toBe('baz');
  });

  test('enforces required policy when reading value', () => {
    const i = new BuildStepInput({ id: 'foo', required: true });
    expect(() => {
      // eslint-disable-next-line
      i.value;
    }).toThrowError(
      new BuildStepInputError('Input parameter "foo" is required but it was not set.')
    );
  });

  test('enforces required policy when setting value', () => {
    const i = new BuildStepInput({ id: 'foo', required: true });
    expect(() => {
      i.set(undefined);
    }).toThrowError(new BuildStepInputError('Input parameter "foo" is required.'));
  });
});
