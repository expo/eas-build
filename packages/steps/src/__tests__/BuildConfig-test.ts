import { validateBuildConfig } from '../BuildConfig.js';
import { BuildConfigError } from '../errors/BuildConfigError.js';

describe(validateBuildConfig, () => {
  test('can throw BuildConfigError', () => {
    const buildConfig = {};

    expect(() => {
      validateBuildConfig(buildConfig);
    }).toThrowError(BuildConfigError);
  });

  describe('steps', () => {
    test('inline command', () => {
      const buildConfig = {
        build: {
          steps: [
            {
              run: 'echo 123',
            },
          ],
        },
      };

      expect(() => {
        validateBuildConfig(buildConfig);
      }).not.toThrowError();
    });

    describe('commands', () => {
      test('command is required', () => {
        const buildConfig = {
          build: {
            steps: [
              {
                run: {},
              },
            ],
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig);
        }).toThrowError(/".*\.command" is required/);
      });
      test('non-existent fields', () => {
        const buildConfig = {
          build: {
            steps: [
              {
                run: {
                  command: 'echo 123',
                  blah: '123',
                },
              },
            ],
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig);
        }).toThrowError(/".*\.blah" is not allowed/);
      });
      test('valid command', () => {
        const buildConfig = {
          build: {
            steps: [
              {
                run: {
                  command: 'echo 123',
                },
              },
            ],
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig);
        }).not.toThrowError();
      });
    });

    describe('function calls', () => {
      test('bare call', () => {
        const buildConfig = {
          build: {
            steps: ['say_hi'],
          },
          functions: {
            say_hi: {
              command: 'echo Hi!',
            },
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig);
        }).not.toThrowError();
      });
      test('non-existent fields', () => {
        const buildConfig = {
          build: {
            steps: [
              {
                say_hi: {
                  blah: '123',
                },
              },
            ],
          },
          functions: {
            say_hi: {
              command: 'echo Hi!',
            },
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig);
        }).toThrowError(/".*\.blah" is not allowed/);
      });
      test('command is not allowed', () => {
        const buildConfig = {
          build: {
            steps: [
              {
                say_hi: {
                  command: 'echo 123',
                },
              },
            ],
          },
          functions: {
            say_hi: {
              command: 'echo Hi!',
            },
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig);
        }).toThrowError(/".*\.command" is not allowed/);
      });
      test('call with inputs', () => {
        const buildConfig = {
          build: {
            steps: [
              {
                say_hi: {
                  inputs: {
                    name: 'Dominik',
                  },
                },
              },
            ],
          },
          functions: {
            say_hi: {
              command: 'echo "Hi, ${ inputs.name }!"',
            },
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig);
        }).not.toThrowError();
      });
      test('at most one function call per step', () => {
        const buildConfig = {
          build: {
            steps: [
              {
                say_hi: {
                  inputs: {
                    name: 'Dominik',
                  },
                },
                say_hello: {
                  inputs: {
                    name: 'Dominik',
                  },
                },
              },
            ],
          },
          functions: {
            say_hi: {
              command: 'echo "Hi, ${ inputs.name }!"',
            },
            say_hello: {
              command: 'echo "Hello, ${ inputs.name }!"',
            },
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig);
        }).toThrowError();
      });
      test('non-existent functions', () => {
        const buildConfig = {
          build: {
            steps: ['say_hi', 'say_hello'],
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig);
        }).toThrowError(/Calling non-existent functions: say_hi, say_hello/);
      });
    });
  });

  describe('functions', () => {
    test('command is required', () => {
      const buildConfig = {
        build: {
          steps: [],
        },
        functions: {
          say_hi: {},
        },
      };

      expect(() => {
        validateBuildConfig(buildConfig);
      }).toThrowError(/".*\.say_hi\.command" is required/);
    });
  });
});
