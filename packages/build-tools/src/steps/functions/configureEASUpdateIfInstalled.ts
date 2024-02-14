import assert from 'assert';

import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import { Metadata } from '@expo/eas-build-job';
import semver from 'semver';

import { configureEASUpdateAsync } from '../utils/expoUpdates';
import { readAppConfig } from '../../utils/appConfig';
import getExpoUpdatesPackageVersionIfInstalledAsync from '../../utils/getExpoUpdatesPackageVersionIfInstalledAsync';

export function configureEASUpdateIfInstalledFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'configure_eas_update',
    name: 'Configure EAS Update',
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
      BuildStepInput.createProvider({
        id: 'throw_if_not_configured',
        required: false,
        defaultValue: true,
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
      }),
    ],
    fn: async (stepCtx, { env, inputs }) => {
      assert(stepCtx.global.staticContext.job, 'Job is not defined');
      const job = stepCtx.global.staticContext.job;
      const metadata = stepCtx.global.staticContext.metadata as Metadata | undefined;

      const appConfig = readAppConfig({
        projectDir: stepCtx.workingDirectory,
        env: Object.keys(env).reduce(
          (acc, key) => {
            acc[key] = env[key] ?? '';
            return acc;
          },
          {} as Record<string, string>
        ),
        logger: stepCtx.logger,
        sdkVersion: metadata?.sdkVersion,
      }).exp;

      const releaseChannelInput = inputs.channel.value as string | undefined;
      const runtimeVersionInput = inputs.runtime_version.value as string | undefined;
      const throwIfNotConfigured = inputs.throw_if_not_configured.value as boolean;
      if (runtimeVersionInput && !semver.valid(runtimeVersionInput)) {
        throw new Error(
          `Runtime version provided by the "runtime_version" input is not a valid semver version: ${releaseChannelInput}`
        );
      }

      const expoUpdatesPackageVersion = await getExpoUpdatesPackageVersionIfInstalledAsync(
        stepCtx.workingDirectory
      );
      if (expoUpdatesPackageVersion === null) {
        if (throwIfNotConfigured) {
          throw new Error(
            'Cannot configure EAS Update because the expo-updates package is not installed.'
          );
        }
        stepCtx.logger.warn(
          'Cannot configure EAS Update because the expo-updates package is not installed.'
        );
        return;
      }

      await configureEASUpdateAsync({
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
