import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import { Ios } from '@expo/eas-build-job';

import { IosBuildCredentialsSchema } from '../../utils/ios/credentials/credentials';
import IosCredentialsManager from '../../utils/ios/credentials/manager';
import { updateVersionsAsync } from '../../utils/ios/configure';
import { resolveBuildConfiguration } from '../../utils/ios/resolve';

export function configureIosVersionFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'utils',
    id: 'configure_ios_version',
    name: 'Configure iOS version',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'credentials',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.JSON,
        defaultValue: '${ eas.job.secrets.buildCredentials }',
      }),
      BuildStepInput.createProvider({
        id: 'build_configuration',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'build_number',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.NUMBER,
        defaultValue: '${ eas.job.version.buildNumber }',
      }),
      BuildStepInput.createProvider({
        id: 'app_version',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        defaultValue: '${ eas.job.version.appVersion }',
      }),
    ],
    fn: async (stepCtx, { inputs }) => {
      const rawCredentialsInput = inputs.credentials.value as Record<string, any>;
      const { value, error } = IosBuildCredentialsSchema.validate(rawCredentialsInput, {
        stripUnknown: true,
        convert: true,
        abortEarly: false,
      });
      if (error) {
        throw error;
      }

      const credentialsManager = new IosCredentialsManager(value);
      const credentials = await credentialsManager.prepare(stepCtx.logger);

      const job = stepCtx.global.staticContext.job as Ios.Job;

      await updateVersionsAsync(
        stepCtx.logger,
        stepCtx.workingDirectory,
        {
          buildNumber: inputs.build_number.value?.toString(),
          appVersion: inputs.app_version.value as string,
        },
        {
          targetNames: Object.keys(credentials.targetProvisioningProfiles),
          buildConfiguration: resolveBuildConfiguration(
            job,
            inputs.build_configuration.value as string | undefined
          ),
        }
      );
    },
  });
}
