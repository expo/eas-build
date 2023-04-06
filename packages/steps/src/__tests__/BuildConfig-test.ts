import assert from 'assert';
import path from 'path';
import url from 'url';

import {
  BuildStepBareCommandRun,
  BuildStepBareFunctionCall,
  BuildStepCommandRun,
  BuildStepFunctionCall,
  isBuildStepBareCommandRun,
  isBuildStepBareFunctionCall,
  isBuildStepCommandRun,
  isBuildStepFunctionCall,
  readRawBuildConfigAsync,
  readAndValidateBuildConfigAsync,
  validateBuildConfig,
} from '../BuildConfig.js';
import { BuildConfigError, BuildConfigYAMLError } from '../errors.js';

import { getError, getErrorAsync } from './utils/error.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

describe(readAndValidateBuildConfigAsync, () => {
  test('valid custom build config', async () => {
    const config = await readAndValidateBuildConfigAsync(
      path.join(__dirname, './fixtures/build.yml'),
      { externalFunctionIds: [] }
    );
    expect(typeof config).toBe('object');
    expect(config.build.name).toBe('Foobar');
    assert(isBuildStepBareCommandRun(config.build.steps[0]));
    expect(config.build.steps[0].run).toBe('echo "Hi!"');
  });
});

describe(readRawBuildConfigAsync, () => {
  test('non-existent file', async () => {
    await expect(readRawBuildConfigAsync('/fake/path/a.yml')).rejects.toThrowError(
      /no such file or directory/
    );
  });
  test('invalid yaml file', async () => {
    const error = await getErrorAsync(async () => {
      return await readRawBuildConfigAsync(path.join(__dirname, './fixtures/invalid.yml'));
    });
    expect(error).toBeInstanceOf(BuildConfigYAMLError);
    expect(error.message).toMatch(/Map keys must be unique at line/);
  });

  test('valid yaml file', async () => {
    const rawConfig = await readRawBuildConfigAsync(path.join(__dirname, './fixtures/build.yml'));
    expect(typeof rawConfig).toBe('object');
  });
});

describe(validateBuildConfig, () => {
  test('can throw BuildConfigError', () => {
    const buildConfig = {};

    expect(() => {
      validateBuildConfig(buildConfig, { externalFunctionIds: [] });
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
        validateBuildConfig(buildConfig, { externalFunctionIds: [] });
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
          validateBuildConfig(buildConfig, { externalFunctionIds: [] });
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
          validateBuildConfig(buildConfig, { externalFunctionIds: [] });
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
          validateBuildConfig(buildConfig, { externalFunctionIds: [] });
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
          validateBuildConfig(buildConfig, { externalFunctionIds: [] });
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
          validateBuildConfig(buildConfig, { externalFunctionIds: [] });
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
          validateBuildConfig(buildConfig, { externalFunctionIds: [] });
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
          validateBuildConfig(buildConfig, { externalFunctionIds: [] });
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
          validateBuildConfig(buildConfig, { externalFunctionIds: [] });
        }).toThrowError();
      });
      test('non-existent functions', () => {
        const buildConfig = {
          build: {
            steps: ['say_hi', 'say_hello'],
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig, { externalFunctionIds: [] });
        }).toThrowError(/Calling non-existent functions: "say_hi", "say_hello"/);
      });
      test('non-existent namespaced functions with skipNamespacedFunctionsCheck = false', () => {
        const buildConfig = {
          build: {
            steps: ['abc/say_hi', 'abc/say_hello'],
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig, {
            externalFunctionIds: [],
            skipNamespacedFunctionsCheck: false,
          });
        }).toThrowError(/Calling non-existent functions: "abc\/say_hi", "abc\/say_hello"/);
      });
      test('non-existent namespaced functions with skipNamespacedFunctionsCheck = true', () => {
        const buildConfig = {
          build: {
            steps: ['abc/say_hi', 'abc/say_hello'],
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig, {
            externalFunctionIds: [],
            skipNamespacedFunctionsCheck: true,
          });
        }).not.toThrow();
      });
      test('works with external functions', () => {
        const buildConfig = {
          build: {
            steps: ['say_hi', 'say_hello'],
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig, { externalFunctionIds: ['say_hi', 'say_hello'] });
        }).not.toThrowError();
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
        validateBuildConfig(buildConfig, { externalFunctionIds: [] });
      }).toThrowError(/".*\.say_hi\.command" is required/);
    });
    test('"run" is not allowed for function name', () => {
      const buildConfig = {
        build: {
          steps: [],
        },
        functions: {
          run: {},
        },
      };

      expect(() => {
        validateBuildConfig(buildConfig, { externalFunctionIds: [] });
      }).toThrowError(/"functions.run" is not allowed/);
    });
    test('function IDs must be alphanumeric (including underscore and dash)', () => {
      const buildConfig = {
        build: {
          steps: [],
        },
        functions: {
          foo: {},
          upload_artifact: {},
          'build-project': {},
          'eas/download_project': {},
          '!@#$': {},
        },
      };

      const error = getError<Error>(() => {
        validateBuildConfig(buildConfig, { externalFunctionIds: [] });
      });
      expect(error.message).toMatch(/"functions\.eas\/download_project" is not allowed/);
      expect(error.message).toMatch(/"functions\.!@#\$" is not allowed/);
      expect(error.message).not.toMatch(/"functions\.foo" is not allowed/);
      expect(error.message).not.toMatch(/"functions\.upload_artifact" is not allowed/);
      expect(error.message).not.toMatch(/"functions\.build-project" is not allowed/);
    });
    test('invalid default and allowed values for function inputs', () => {
      const buildConfig = {
        build: {
          steps: ['abc'],
        },
        functions: {
          abc: {
            inputs: [
              {
                name: 'i1',
                default_value: 1,
              },
              {
                name: 'i2',
                default_value: '1',
                allowed_values: ['2', '3'],
              },
            ],
            command: 'echo "${ inputs.i1 } ${ inputs.i2 }"',
          },
        },
      };

      const error = getError<Error>(() => {
        validateBuildConfig(buildConfig, { externalFunctionIds: [] });
      });
      expect(error.message).toMatch(/"functions.abc.inputs\[0\].defaultValue" must be a string/);
      expect(error.message).toMatch(
        /"functions.abc.inputs\[1\].defaultValue" must be one of allowed values/
      );
    });
    test('valid default and allowed values for function inputs', () => {
      const buildConfig = {
        build: {
          steps: ['abc'],
        },
        functions: {
          abc: {
            inputs: [
              {
                name: 'i1',
                default_value: '1',
              },
              {
                name: 'i2',
                default_value: '1',
                allowed_values: ['1', '2'],
              },
            ],
            command: 'echo "${ inputs.i1 } ${ inputs.i2 }"',
          },
        },
      };

      expect(() => {
        validateBuildConfig(buildConfig, { externalFunctionIds: [] });
      }).not.toThrow();
    });
  });
});

const buildStepCommandRun: BuildStepCommandRun = {
  run: {
    command: 'echo 123',
  },
};

const buildStepBareCommandRun: BuildStepBareCommandRun = {
  run: 'echo 123',
};

const buildStepFunctionCall: BuildStepFunctionCall = {
  say_hi: {
    inputs: {
      name: 'Dominik',
    },
  },
};

const buildStepBareFunctionCall: BuildStepBareFunctionCall = 'say_hi';

describe(isBuildStepCommandRun, () => {
  it.each([buildStepBareCommandRun, buildStepFunctionCall, buildStepBareFunctionCall])(
    'returns false',
    (i) => {
      expect(isBuildStepCommandRun(i)).toBe(false);
    }
  );
  it('returns true', () => {
    expect(isBuildStepCommandRun(buildStepCommandRun)).toBe(true);
  });
});

describe(isBuildStepBareCommandRun, () => {
  it.each([buildStepCommandRun, buildStepFunctionCall, buildStepBareFunctionCall])(
    'returns false',
    (i) => {
      expect(isBuildStepBareCommandRun(i)).toBe(false);
    }
  );
  it('returns true', () => {
    expect(isBuildStepBareCommandRun(buildStepBareCommandRun)).toBe(true);
  });
});

describe(isBuildStepFunctionCall, () => {
  it.each([buildStepCommandRun, buildStepBareCommandRun, buildStepBareFunctionCall])(
    'returns false',
    (i) => {
      expect(isBuildStepFunctionCall(i)).toBe(false);
    }
  );
  it('returns true', () => {
    expect(isBuildStepFunctionCall(buildStepFunctionCall)).toBe(true);
  });
});

describe(isBuildStepBareFunctionCall, () => {
  it.each([buildStepCommandRun, buildStepBareCommandRun, buildStepFunctionCall])(
    'returns false',
    (i) => {
      expect(isBuildStepBareFunctionCall(i)).toBe(false);
    }
  );
  it('returns true', () => {
    expect(isBuildStepBareFunctionCall(buildStepBareFunctionCall)).toBe(true);
  });
});
