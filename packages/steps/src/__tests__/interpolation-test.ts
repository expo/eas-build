import { interpolateJobContextAsync } from '../interpolation.js';

describe(interpolateJobContextAsync, () => {
  describe('string interpolation', () => {
    it('interpolates a simple expression that is the entire string', async () => {
      const result = await interpolateJobContextAsync({
        target: '${{ inputs.build }}',
        context: { inputs: { build: 'production' } } as any,
      });
      expect(result).toBe('production');
    });

    it('preserves type when the entire string is an expression', async () => {
      const result = await interpolateJobContextAsync({
        target: '${{ inputs.config }}',
        context: { inputs: { config: { key: 'value', nested: { flag: true } } as any } } as any,
      });
      expect(result).toEqual({ key: 'value', nested: { flag: true } });
    });

    it('preserves boolean type when the entire string is an expression', async () => {
      const result = await interpolateJobContextAsync({
        target: '${{ inputs.enabled }}',
        context: { inputs: { enabled: true } } as any,
      });
      expect(result).toBe(true);
    });

    it('preserves number type when the entire string is an expression', async () => {
      const result = await interpolateJobContextAsync({
        target: '${{ inputs.count }}',
        context: { inputs: { count: 42 } } as any,
      });
      expect(result).toBe(42);
    });

    it('interpolates a single expression within a string', async () => {
      const result = await interpolateJobContextAsync({
        target: 'echo ${{ build.profile }}',
        context: { build: { profile: 'production' } } as any,
      });
      expect(result).toBe('echo production');
    });

    it('interpolates multiple expressions within a string', async () => {
      const result = await interpolateJobContextAsync({
        target: 'echo ${{ env.NAME }} on ${{ env.PLATFORM }}',
        context: { env: { NAME: 'myapp', PLATFORM: 'ios' } } as any,
      });
      expect(result).toBe('echo myapp on ios');
    });

    it('interpolates expressions with arithmetic', async () => {
      const result = await interpolateJobContextAsync({
        target: 'workers: ${{ inputs.workers + 1 }}',
        context: { inputs: { workers: 5 } } as any,
      });
      expect(result).toBe('workers: 6');
    });

    it('interpolates expressions with string concatenation', async () => {
      const result = await interpolateJobContextAsync({
        target: 'name-${{ inputs.prefix + "-suffix" }}',
        context: { inputs: { prefix: 'prod' } } as any,
      });
      expect(result).toBe('name-prod-suffix');
    });

    it('interpolates multiple identical expressions', async () => {
      const result = await interpolateJobContextAsync({
        target: '${{ env.VALUE }} and ${{ env.VALUE }} again',
        context: { env: { VALUE: 'test' } } as any,
      });
      expect(result).toBe('test and test again');
    });

    it('interpolates expressions with ternary operators', async () => {
      const result = await interpolateJobContextAsync({
        target: 'profile: ${{ env.NODE_ENV === "production" ? "prod" : "dev" }}',
        context: { env: { NODE_ENV: 'production' } } as any,
      });
      expect(result).toBe('profile: prod');
    });

    it('handles expressions with whitespace variations', async () => {
      const result = await interpolateJobContextAsync({
        target: '${{inputs.value}}',
        context: { inputs: { value: 'no-spaces' } } as any,
      });
      expect(result).toBe('no-spaces');
    });

    it('returns the string as-is when there are no expressions', async () => {
      const result = await interpolateJobContextAsync({
        target: 'plain string without expressions',
        context: {} as any,
      });
      expect(result).toBe('plain string without expressions');
    });

    it('handles empty string', async () => {
      const result = await interpolateJobContextAsync({
        target: '',
        context: {} as any,
      });
      expect(result).toBe('');
    });

    it('handles undefined values in expressions', async () => {
      const result = await interpolateJobContextAsync({
        target: 'value: ${{ inputs.missing }}',
        context: { inputs: {} } as any,
      });
      expect(result).toBe('value: undefined');
    });

    it('handles async function calls in expressions', async () => {
      const asyncFnAsync = async (val: string): Promise<string> => `async-${val}`;
      const result = await interpolateJobContextAsync({
        target: 'result: ${{ fn("test") }}',
        context: { fn: asyncFnAsync } as any,
      });
      expect(result).toBe('result: async-test');
    });
  });

  describe('array interpolation', () => {
    it('interpolates strings in an array', async () => {
      const result = await interpolateJobContextAsync({
        target: ['echo ${{ env.NAME }}', 'build ${{ env.TARGET }}'],
        context: { env: { NAME: 'app', TARGET: 'ios' } } as any,
      });
      expect(result).toEqual(['echo app', 'build ios']);
    });

    it('interpolates mixed types in an array', async () => {
      const result = await interpolateJobContextAsync({
        target: ['${{ inputs.count }}', 'string', '${{ inputs.flag }}'],
        context: { inputs: { count: 42, flag: true } } as any,
      });
      expect(result).toEqual([42, 'string', true]);
    });

    it('handles nested arrays', async () => {
      const result = await interpolateJobContextAsync({
        target: [['${{ env.A }}', '${{ env.B }}'], ['${{ env.C }}']],
        context: { env: { A: '1', B: '2', C: '3' } } as any,
      });
      expect(result).toEqual([['1', '2'], ['3']]);
    });

    it('handles empty arrays', async () => {
      const result = await interpolateJobContextAsync({
        target: [],
        context: {} as any,
      });
      expect(result).toEqual([]);
    });
  });

  describe('object interpolation', () => {
    it('interpolates string values in an object', async () => {
      const result = await interpolateJobContextAsync({
        target: {
          command: 'echo ${{ env.NAME }}',
          workingDirectory: '/path/${{ env.DIR }}',
        },
        context: { env: { NAME: 'app', DIR: 'build' } } as any,
      });
      expect(result).toEqual({
        command: 'echo app',
        workingDirectory: '/path/build',
      });
    });

    it('interpolates mixed types in an object', async () => {
      const result = await interpolateJobContextAsync({
        target: {
          count: '${{ inputs.count }}',
          enabled: '${{ inputs.enabled }}',
          name: 'static',
        },
        context: { inputs: { count: 5, enabled: true } } as any,
      });
      expect(result).toEqual({
        count: 5,
        enabled: true,
        name: 'static',
      });
    });

    it('handles nested objects', async () => {
      const result = await interpolateJobContextAsync({
        target: {
          outer: {
            inner: '${{ env.VALUE }}',
            another: 'static',
          },
          top: '${{ env.TOP }}',
        },
        context: { env: { VALUE: 'inner-value', TOP: 'top-value' } } as any,
      });
      expect(result).toEqual({
        outer: {
          inner: 'inner-value',
          another: 'static',
        },
        top: 'top-value',
      });
    });

    it('handles empty objects', async () => {
      const result = await interpolateJobContextAsync({
        target: {},
        context: {} as any,
      });
      expect(result).toEqual({});
    });

    it('handles objects with array values', async () => {
      const result = await interpolateJobContextAsync({
        target: {
          commands: ['echo ${{ env.A }}', 'ls ${{ env.B }}'],
        },
        context: { env: { A: 'hello', B: '-la' } } as any,
      });
      expect(result).toEqual({
        commands: ['echo hello', 'ls -la'],
      });
    });
  });

  describe('primitive values', () => {
    it('returns numbers as-is', async () => {
      const result = await interpolateJobContextAsync({
        target: 42,
        context: {} as any,
      });
      expect(result).toBe(42);
    });

    it('returns booleans as-is', async () => {
      const result = await interpolateJobContextAsync({
        target: true,
        context: {} as any,
      });
      expect(result).toBe(true);
    });

    it('returns null as-is', async () => {
      const result = await interpolateJobContextAsync({
        target: null,
        context: {} as any,
      });
      expect(result).toBe(null);
    });

    it('returns undefined as-is', async () => {
      const result = await interpolateJobContextAsync({
        target: undefined,
        context: {} as any,
      });
      expect(result).toBe(undefined);
    });
  });

  describe('complex nested structures', () => {
    it('interpolates deeply nested structures', async () => {
      const result = await interpolateJobContextAsync({
        target: {
          steps: [
            {
              name: 'Build ${{ inputs.platform }}',
              commands: ['echo ${{ env.MESSAGE }}', 'build --target=${{ inputs.target }}'],
              config: {
                timeout: '${{ inputs.timeout }}',
                retry: '${{ inputs.retry }}',
              },
            },
          ],
        },
        context: {
          inputs: { platform: 'ios', target: 'simulator', timeout: 300, retry: 3 },
          env: { MESSAGE: 'Starting build' },
        } as any,
      });
      expect(result).toEqual({
        steps: [
          {
            name: 'Build ios',
            commands: ['echo Starting build', 'build --target=simulator'],
            config: {
              timeout: 300,
              retry: 3,
            },
          },
        ],
      });
    });

    it('handles mixed interpolation and static content', async () => {
      const result = await interpolateJobContextAsync({
        target: {
          static: 'value',
          dynamic: '${{ inputs.value }}',
          mixed: 'prefix-${{ inputs.suffix }}',
          nested: {
            array: ['${{ env.A }}', 'static', '${{ env.B }}'],
            object: {
              key: '${{ env.C }}',
            },
          },
        },
        context: {
          inputs: { value: 'dynamic', suffix: 'end' },
          env: { A: '1', B: '2', C: '3' },
        } as any,
      });
      expect(result).toEqual({
        static: 'value',
        dynamic: 'dynamic',
        mixed: 'prefix-end',
        nested: {
          array: ['1', 'static', '2'],
          object: {
            key: '3',
          },
        },
      });
    });
  });
});
