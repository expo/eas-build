import assert from 'assert';

import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import { Job } from '@expo/eas-build-job';
import semver from 'semver';

import { readAppConfig } from '../../../utils/appConfig';
import { configureEASUpdateIfInstalledAsync } from '../../utils/expoUpdates';

export function configureEASUpdateIfInstalledFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'configure_eas_update_if_installed',
    name: 'Configure EAS Update if installed',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'runtime_version',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'channel',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async (stepCtx, { env, inputs }) => {
      assert(stepCtx.global.staticContext.job, 'Job is not defined');
      const job = stepCtx.global.staticContext.job as Job;

      const appConfig = readAppConfig(
        stepCtx.workingDirectory,
        Object.keys(env).reduce((acc, key) => {
          acc[key] = env[key] ?? '';
          return acc;
        }, {} as Record<string, string>),
        stepCtx.logger
      ).exp;

      const releaseChannelInput = inputs.channel.value as string | undefined;
      const runtimeVersionInput = inputs.runtime_version.value as string | undefined;
      if (runtimeVersionInput && !semver.valid(runtimeVersionInput)) {
        throw new Error(
          `Runtime version provided by the "runtime_version" input is not a valid semver version: ${releaseChannelInput}`
        );
      }

      await configureEASUpdateIfInstalledAsync({
        job,
        workingDirectory: stepCtx.workingDirectory,
        logger: stepCtx.logger,
        appConfig,
        inputs: {
          runtimeVersion: runtimeVersionInput,
          channel: releaseChannelInput,
        },
      });
    },
  });
}
