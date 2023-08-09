import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import semver from 'semver';

import { injectConfigureVersionGradleConfig } from '../utils/android/gradleConfig';

export function configureAndroidVersionFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'configure_android_version',
    name: 'Configure Android version',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'version_name',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        defaultValue: '${ eas.job.version.versionName }',
      }),
      BuildStepInput.createProvider({
        id: 'version_code',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
        defaultValue: '${ eas.job.version.versionCode }',
      }),
    ],
    fn: async (stepCtx, { inputs }) => {
      const versionCode = inputs.version_code.value as number;
      const versionName = inputs.version_name.value as string;
      if (!semver.valid(versionName)) {
        throw new Error(
          `Version name provided by the "version_name" input is not a valid semver version: ${versionName}`
        );
      }
      await injectConfigureVersionGradleConfig(stepCtx.logger, stepCtx.workingDirectory, {
        versionCode,
        versionName,
      });
    },
  });
}
