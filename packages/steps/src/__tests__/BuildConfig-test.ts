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
  validateConfig,
  BuildFunctionsConfigFileSchema,
  BuildConfigSchema,
  validateAllFunctionsExist,
  BuildConfig,
  mergeConfigWithImportedFunctions,
  BuildFunctions,
  readAndValidateBuildFunctionsConfigFileAsync,
} from '../BuildConfig.js';
import { BuildConfigError, BuildConfigYAMLError } from '../errors.js';

import { getError, getErrorAsync } from './utils/error.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

describe(readAndValidateBuildConfigAsync, () => {
  test('valid custom build config', async () => {
    const config = await readAndValidateBuildConfigAsync(
      path.join(__dirname, './fixtures/build.yml'),
      {
        externalFunctionIds: [],
      }
    );
    expect(typeof config).toBe('object');
    expect(config.build.name).toBe('Foobar');
    assert(isBuildStepBareCommandRun(config.build.steps[0]));
    expect(config.build.steps[0].run).toBe('echo "Hi!"');
  });
  test('valid custom build config with imports', async () => {
    const config = await readAndValidateBuildConfigAsync(
      path.join(__dirname, './fixtures/build-with-import.yml'),
      {
        externalFunctionIds: [],
      }
    );
    expect(typeof config).toBe('object');
    expect(config.build.name).toBe('Import!');
    assert(isBuildStepFunctionCall(config.build.steps[0]));
    expect(config.build.steps[0]).toMatchObject({ say_hi: expect.any(Object) });
    assert(isBuildStepBareFunctionCall(config.build.steps[1]));
    expect(config.build.steps[1]).toBe('say_hi_wojtek');
    expect(config.functions?.say_hi).toBeDefined();
    expect(config.functions?.say_hi_wojtek).toBeDefined();
  });
  test('import cycle does not result in infinite loop', async () => {
    const config = await readAndValidateBuildConfigAsync(
      path.join(__dirname, './fixtures/build-with-import-cycle.yml'),
      {
        externalFunctionIds: [],
      }
    );
    expect(typeof config).toBe('object');
    expect(config.build.name).toBe('Import!');
    assert(isBuildStepFunctionCall(config.build.steps[0]));
    expect(config.build.steps[0]).toMatchObject({ say_hi: expect.any(Object) });
    expect(config.functions?.say_hi).toBeDefined();
  });
  test('function precedence', async () => {
    const config = await readAndValidateBuildConfigAsync(
      path.join(__dirname, './fixtures/build-with-import.yml'),
      {
        externalFunctionIds: [],
      }
    );
    expect(typeof config).toBe('object');
    expect(config.functions?.say_hi_wojtek).toBeDefined();
    expect(config.functions?.say_hi_wojtek.name).toBe('Hi, Wojtek!');
    expect(config.functions?.say_hi_wojtek.command).toBe('echo "Hi, Wojtek!"');
  });
});

describe(readAndValidateBuildFunctionsConfigFileAsync, () => {
  test('valid functions config', async () => {
    const config = await readAndValidateBuildFunctionsConfigFileAsync(
      path.join(__dirname, './fixtures/functions-file-1.yml')
    );
    expect(typeof config).toBe('object');
    expect(config.configFilesToImport?.[0]).toBe('functions-file-2.yml');
    expect(config.functions?.say_hi).toBeDefined();
  });
  test('valid functions with platform property config', async () => {
    const config = await readAndValidateBuildFunctionsConfigFileAsync(
      path.join(__dirname, './fixtures/functions-with-platforms-property.yml')
    );
    expect(typeof config).toBe('object');
    expect(config.functions?.say_hi_linux_and_darwin).toBeDefined();
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

describe(validateConfig, () => {
  test('can throw BuildConfigError', () => {
    const buildConfig = {};

    expect(() => {
      validateConfig(BuildConfigSchema, buildConfig);
    }).toThrowError(BuildConfigError);
  });

  describe('with BuildConfigSchema', () => {
    describe('import', () => {
      test('non-yaml files', () => {
        const buildConfig = {
          configFilesToImport: ['a.apk', 'b.ipa'],
          build: {
            steps: [{ run: 'echo 123' }],
          },
        };

        const error = getError<Error>(() => {
          validateConfig(BuildConfigSchema, buildConfig);
        });
        expect(error.message).toMatch(
          /"configFilesToImport\[0\]" with value ".*" fails to match the required pattern/
        );
        expect(error.message).toMatch(
          /"configFilesToImport\[1\]" with value ".*" fails to match the required pattern/
        );
      });
      test('yaml files', () => {
        const buildConfig = {
          configFilesToImport: ['a.yaml', 'b.yml'],
          build: {
            steps: [{ run: 'echo 123' }],
          },
        };

        expect(() => {
          validateConfig(BuildConfigSchema, buildConfig);
        }).not.toThrowError();
      });
    });

    describe('build.steps', () => {
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
          validateConfig(BuildConfigSchema, buildConfig);
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
            validateConfig(BuildConfigSchema, buildConfig);
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
            validateConfig(BuildConfigSchema, buildConfig);
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
            validateConfig(BuildConfigSchema, buildConfig);
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
            validateConfig(BuildConfigSchema, buildConfig);
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
            validateConfig(BuildConfigSchema, buildConfig);
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
            validateConfig(BuildConfigSchema, buildConfig);
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
            validateConfig(BuildConfigSchema, buildConfig);
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
            validateConfig(BuildConfigSchema, buildConfig);
          }).toThrowError();
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
          validateConfig(BuildConfigSchema, buildConfig);
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
          validateConfig(BuildConfigSchema, buildConfig);
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
          validateConfig(BuildConfigSchema, buildConfig);
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
          validateConfig(BuildConfigSchema, buildConfig);
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
          validateConfig(BuildConfigSchema, buildConfig);
        }).not.toThrow();
      });

      test('valid allowed platforms for function', () => {
        const buildConfig = {
          build: {
            steps: ['abc'],
          },
          functions: {
            abc: {
              supported_platforms: ['linux', 'darwin'],
              command: 'echo "abc"',
            },
          },
        };

        expect(() => {
          validateConfig(BuildConfigSchema, buildConfig);
        }).not.toThrow();
      });
    });

    test('invalid allowed platforms for function', () => {
      const buildConfig = {
        build: {
          steps: ['abc'],
        },
        functions: {
          abc: {
            supported_platforms: ['invalid'],
            command: 'echo "abc"',
          },
        },
      };

      expect(() => {
        validateConfig(BuildConfigSchema, buildConfig);
      }).toThrow();
    });
  });

  describe('with BuildFunctionsConfigFileSchema', () => {
    test('"build" is not allowed', () => {
      const buildFunctionsConfig = {
        build: {
          steps: ['abc'],
        },
        functions: {
          abc: { command: 'echo abc' },
        },
      };
      const error = getError<Error>(() => {
        validateConfig(BuildFunctionsConfigFileSchema, buildFunctionsConfig);
      });
      expect(error).toBeInstanceOf(BuildConfigError);
      expect(error.message).toBe('"build" is not allowed');
    });
    test('valid config', () => {
      const buildFunctionsConfig = {
        functions: {
          abc: { command: 'echo abc' },
        },
      };
      expect(() => {
        validateConfig(BuildFunctionsConfigFileSchema, buildFunctionsConfig);
      }).not.toThrow();
    });
  });
});

describe(mergeConfigWithImportedFunctions, () => {
  test('merging config with imported functions', () => {
    const buildConfig: BuildConfig = {
      configFilesToImport: ['func.yaml'],
      build: {
        steps: ['a', 'b', 'c'],
      },
      functions: {
        a: { command: 'echo a' },
      },
    };
    const importedFunctions: BuildFunctions = {
      b: { command: 'echo b' },
      c: { command: 'echo c' },
    };
    mergeConfigWithImportedFunctions(buildConfig, importedFunctions);
    expect(buildConfig.functions?.b).toBe(importedFunctions.b);
    expect(buildConfig.functions?.c).toBe(importedFunctions.c);
  });
  test('functions from base config shadow the imported ones', () => {
    const buildConfig: BuildConfig = {
      build: {
        steps: ['a', 'b', 'c'],
      },
      functions: {
        a: { command: 'echo a1' },
      },
    };
    const importedFunctions: BuildFunctions = {
      a: { command: 'echo a2' },
      b: { command: 'echo b' },
      c: { command: 'echo c' },
    };
    mergeConfigWithImportedFunctions(buildConfig, importedFunctions);
    expect(buildConfig.functions?.a).not.toBe(importedFunctions.a);
    expect(buildConfig.functions?.a.command).toBe('echo a1');
    expect(buildConfig.functions?.b).toBe(importedFunctions.b);
    expect(buildConfig.functions?.c).toBe(importedFunctions.c);
  });
});

describe(validateAllFunctionsExist, () => {
  test('non-existent functions', () => {
    const buildConfig: BuildConfig = {
      build: {
        steps: ['say_hi', 'say_hello'],
      },
    };

    expect(() => {
      validateAllFunctionsExist(buildConfig, { externalFunctionIds: [] });
    }).toThrowError(/Calling non-existent functions: "say_hi", "say_hello"/);
  });
  test('non-existent namespaced functions with skipNamespacedFunctionsCheck = false', () => {
    const buildConfig: BuildConfig = {
      build: {
        steps: ['abc/say_hi', 'abc/say_hello'],
      },
    };

    expect(() => {
      validateAllFunctionsExist(buildConfig, {
        externalFunctionIds: [],
        skipNamespacedFunctionsCheck: false,
      });
    }).toThrowError(/Calling non-existent functions: "abc\/say_hi", "abc\/say_hello"/);
  });
  test('non-existent namespaced functions with skipNamespacedFunctionsCheck = true', () => {
    const buildConfig: BuildConfig = {
      build: {
        steps: ['abc/say_hi', 'abc/say_hello'],
      },
    };

    expect(() => {
      validateAllFunctionsExist(buildConfig, {
        externalFunctionIds: [],
        skipNamespacedFunctionsCheck: true,
      });
    }).not.toThrow();
  });
  test('works with external functions', () => {
    const buildConfig: BuildConfig = {
      build: {
        steps: ['say_hi', 'say_hello'],
      },
    };

    expect(() => {
      validateAllFunctionsExist(buildConfig, {
        externalFunctionIds: ['say_hi', 'say_hello'],
      });
    }).not.toThrowError();
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
