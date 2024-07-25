import { StepZ } from '../step';

describe('StepZ', () => {
  it('accepts valid script step', () => {
    const step = {
      run: 'echo Hello, world!',
      shell: 'sh',
    };
    expect(StepZ.parse(step)).toEqual(step);
  });

  it('accepts valid function step', () => {
    const step = {
      uses: 'eas/build',
      with: {
        arg1: 'value1',
        arg2: 2,
        arg3: {
          key1: 'value1',
          key2: ['value1'],
        },
        arg4: '${{ steps.step1.outputs.test }}',
      },
    };
    expect(StepZ.parse(step)).toEqual(step);
  });

  it('errors when step is both script and function step', () => {
    const step = {
      run: 'echo Hello, world!',
      uses: 'eas/build',
    };
    expect(() => StepZ.parse(step)).toThrow('Invalid input');
  });

  it('errors when step is neither script nor function step', () => {
    const step = {
      id: 'step1',
      name: 'Step 1',
    };
    expect(() => StepZ.parse(step)).toThrow('Invalid input');
  });

  it('valid step with all properties', () => {
    const step = {
      id: 'step1',
      name: 'Step 1',
      if: '${ steps.step1.outputs.test } == 1',
      run: 'echo Hello, world!',
      shell: 'sh',
      env: {
        KEY1: 'value1',
      },
    };
    expect(StepZ.parse(step)).toEqual(step);
  });
});
