import {
  BuildStepBareCommandRun,
  BuildStepBareFunctionCall,
  BuildStepCommandRun,
  BuildStepFunctionCall,
  isBuildStepBareCommandRun,
  isBuildStepBareFunctionCall,
  isBuildStepCommandRun,
  isBuildStepFunctionCall,
  validateBuildConfig,
} from '../BuildConfig.js';
import { BuildConfigError } from '../errors/BuildConfigError.js';
import { getError } from './utils/error.js';

describe(validateBuildConfig, () => {
  test('can throw BuildConfigError', () => {
    const buildConfig = {};

    expect(() => {
      validateBuildConfig(buildConfig, []);
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
        validateBuildConfig(buildConfig, []);
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
          validateBuildConfig(buildConfig, []);
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
          validateBuildConfig(buildConfig, []);
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
          validateBuildConfig(buildConfig, []);
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
          validateBuildConfig(buildConfig, []);
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
          validateBuildConfig(buildConfig, []);
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
          validateBuildConfig(buildConfig, []);
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
          validateBuildConfig(buildConfig, []);
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
          validateBuildConfig(buildConfig, []);
        }).toThrowError();
      });
      test('non-existent functions', () => {
        const buildConfig = {
          build: {
            steps: ['say_hi', 'say_hello'],
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig, []);
        }).toThrowError(/Calling non-existent functions: "say_hi", "say_hello"/);
      });
      test('works with external functions', () => {
        const buildConfig = {
          build: {
            steps: ['say_hi', 'say_hello'],
          },
        };

        expect(() => {
          validateBuildConfig(buildConfig, ['say_hi', 'say_hello']);
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
        validateBuildConfig(buildConfig, []);
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
        validateBuildConfig(buildConfig, []);
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
        validateBuildConfig(buildConfig, []);
      });
      expect(error.message).toMatch(/"functions\.eas\/download_project" is not allowed/);
      expect(error.message).toMatch(/"functions\.!@#\$" is not allowed/);
      expect(error.message).not.toMatch(/"functions\.foo" is not allowed/);
      expect(error.message).not.toMatch(/"functions\.build-project" is not allowed/);
      expect(error.message).not.toMatch(/"functions\.build-project" is not allowed/);
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
