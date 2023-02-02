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
  });
});
