import { Ios } from '@expo/eas-build-job';
import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  BuildStepOutput,
} from '@expo/steps';
import Joi from 'joi';

import IosCredentialsManager from '../../utils/ios/credentials/manager';

const TargetCredentialsSchema = Joi.object<Ios.TargetCredentials>().keys({
  provisioningProfileBase64: Joi.string().required(),
  distributionCertificate: Joi.object({
    dataBase64: Joi.string().required(),
    password: Joi.string().allow('').required(),
  }).required(),
});

const IosBuildCredentialsSchema = Joi.object<Ios.BuildCredentials>().pattern(
  Joi.string().required(),
  TargetCredentialsSchema
);

export function resolveAppleTeamIdFromCredentialsFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'utils',
    id: 'resolve_apple_team_id_from_credentials',
    name: 'Resolve Apple team ID from credentials',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'credentials',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.JSON,
        defaultValue: '${ eas.job.secrets.buildCredentials }',
      }),
    ],
    outputProviders: [
      BuildStepOutput.createProvider({
        id: 'apple_team_id',
        required: true,
      }),
    ],
    fn: async (stepCtx, { inputs, outputs }) => {
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

      stepCtx.logger.info(`Using Apple Team ID: ${credentials.teamId}`);
      outputs.apple_team_id.set(credentials.teamId);
    },
  });
}
