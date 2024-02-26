import { BuildFunctionGroup, BuildStep, BuildStepGlobalContext } from '@expo/steps';
import { Platform } from '@expo/eas-build-job';

import { createCheckoutBuildFunction } from '../functions/checkout';
import { createInstallNodeModulesBuildFunction } from '../functions/installNodeModules';
import { createPrebuildBuildFunction } from '../functions/prebuild';
import { createInstallPodsBuildFunction } from '../functions/installPods';
import { configureEASUpdateIfInstalledFunction } from '../functions/configureEASUpdateIfInstalled';
import { generateGymfileFromTemplateFunction } from '../functions/generateGymfileFromTemplate';
import { runFastlaneFunction } from '../functions/runFastlane';
import { createFindAndUploadBuildArtifactsBuildFunction } from '../functions/findAndUploadBuildArtifacts';
import { CustomBuildContext } from '../../customBuildContext';
import { createGetCredentialsForBuildTriggeredByGithubIntegration } from '../functions/getCredentialsForBuildTriggeredByGitHubIntegration';
import { resolveAppleTeamIdFromCredentialsFunction } from '../functions/resolveAppleTeamIdFromCredentials';
import { configureIosCredentialsFunction } from '../functions/configureIosCredentials';
import { runGradleFunction } from '../functions/runGradle';
import { configureIosVersionFunction } from '../functions/configureIosVersion';
import { injectAndroidCredentialsFunction } from '../functions/injectAndroidCredentials';
import { configureAndroidVersionFunction } from '../functions/configureAndroidVersion';
import { createSetUpNpmrcBuildFunction } from '../functions/useNpmToken';

interface HelperFunctionsInput {
  globalCtx: BuildStepGlobalContext;
  buildToolsContext: CustomBuildContext;
}

export function createEasBuildBuildFunctionGroup(
  buildToolsContext: CustomBuildContext
): BuildFunctionGroup {
  return new BuildFunctionGroup({
    namespace: 'eas',
    id: 'build',
    createBuildStepsFromFunctionGroupCall: (globalCtx) => {
      if (buildToolsContext.job.platform === Platform.IOS) {
        // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
        if (buildToolsContext.job.simulator || !buildToolsContext.job.secrets?.buildCredentials) {
          return createStepsForIosSimulatorBuild({
            globalCtx,
            buildToolsContext,
          });
        } else {
          return createStepsForIosBuildWithCredentials({
            globalCtx,
            buildToolsContext,
          });
        }
      } else {
        if (!buildToolsContext.job.secrets?.buildCredentials) {
          return createStepsForAndroidBuildWithoutCredentials({
            globalCtx,
            buildToolsContext,
          });
        } else {
          return createStepsForAndroidBuildWithCredentials({
            globalCtx,
            buildToolsContext,
          });
        }
      }
    },
  });
}

function createStepsForIosSimulatorBuild({
  globalCtx,
  buildToolsContext,
}: HelperFunctionsInput): BuildStep[] {
  const installPods = createInstallPodsBuildFunction().createBuildStepFromFunctionCall(globalCtx, {
    workingDirectory: './ios',
  });
  const configureEASUpdate =
    configureEASUpdateIfInstalledFunction().createBuildStepFromFunctionCall(globalCtx, {
      callInputs: {
        throw_if_not_configured: false,
      },
    });
  const runFastlane = runFastlaneFunction();
  return [
    createCheckoutBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createSetUpNpmrcBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createInstallNodeModulesBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createPrebuildBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    installPods,
    configureEASUpdate,
    generateGymfileFromTemplateFunction().createBuildStepFromFunctionCall(globalCtx),
    runFastlane.createBuildStepFromFunctionCall(globalCtx, { id: runFastlane.id }),
    createFindAndUploadBuildArtifactsBuildFunction(
      buildToolsContext
    ).createBuildStepFromFunctionCall(globalCtx),
  ];
}

function createStepsForIosBuildWithCredentials({
  globalCtx,
  buildToolsContext,
}: HelperFunctionsInput): BuildStep[] {
  const resolveAppleTeamIdFromCredentials =
    resolveAppleTeamIdFromCredentialsFunction().createBuildStepFromFunctionCall(globalCtx, {
      id: 'resolve_apple_team_id_from_credentials',
    });
  const prebuildStep = createPrebuildBuildFunction().createBuildStepFromFunctionCall(globalCtx, {
    callInputs: {
      apple_team_id: '${ steps.resolve_apple_team_id_from_credentials.apple_team_id }',
    },
  });
  const installPods = createInstallPodsBuildFunction().createBuildStepFromFunctionCall(globalCtx, {
    workingDirectory: './ios',
  });
  const configureEASUpdate =
    configureEASUpdateIfInstalledFunction().createBuildStepFromFunctionCall(globalCtx, {
      callInputs: {
        throw_if_not_configured: false,
      },
    });
  const generateGymfile = generateGymfileFromTemplateFunction().createBuildStepFromFunctionCall(
    globalCtx,
    {
      callInputs: {
        credentials: '${ eas.job.secrets.buildCredentials }',
      },
    }
  );
  const runFastlane = runFastlaneFunction();
  return [
    createCheckoutBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createSetUpNpmrcBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createInstallNodeModulesBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createGetCredentialsForBuildTriggeredByGithubIntegration(
      buildToolsContext
    ).createBuildStepFromFunctionCall(globalCtx),
    resolveAppleTeamIdFromCredentials,
    prebuildStep,
    installPods,
    configureEASUpdate,
    configureIosCredentialsFunction().createBuildStepFromFunctionCall(globalCtx),
    configureIosVersionFunction().createBuildStepFromFunctionCall(globalCtx),
    generateGymfile,
    runFastlane.createBuildStepFromFunctionCall(globalCtx, { id: runFastlane.id }),
    createFindAndUploadBuildArtifactsBuildFunction(
      buildToolsContext
    ).createBuildStepFromFunctionCall(globalCtx),
  ];
}

function createStepsForAndroidBuildWithoutCredentials({
  globalCtx,
  buildToolsContext,
}: HelperFunctionsInput): BuildStep[] {
  const configureEASUpdate =
    configureEASUpdateIfInstalledFunction().createBuildStepFromFunctionCall(globalCtx, {
      callInputs: {
        throw_if_not_configured: false,
      },
    });
  const runGradle = runGradleFunction();
  return [
    createCheckoutBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createSetUpNpmrcBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createInstallNodeModulesBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createPrebuildBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    configureEASUpdate,
    runGradle.createBuildStepFromFunctionCall(globalCtx, { id: runGradle.id }),
    createFindAndUploadBuildArtifactsBuildFunction(
      buildToolsContext
    ).createBuildStepFromFunctionCall(globalCtx),
  ];
}

function createStepsForAndroidBuildWithCredentials({
  globalCtx,
  buildToolsContext,
}: HelperFunctionsInput): BuildStep[] {
  const configureEASUpdate =
    configureEASUpdateIfInstalledFunction().createBuildStepFromFunctionCall(globalCtx, {
      callInputs: {
        throw_if_not_configured: false,
      },
    });
  const runGradle = runGradleFunction();
  return [
    createCheckoutBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createSetUpNpmrcBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createInstallNodeModulesBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createGetCredentialsForBuildTriggeredByGithubIntegration(
      buildToolsContext
    ).createBuildStepFromFunctionCall(globalCtx),
    createPrebuildBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    configureEASUpdate,
    injectAndroidCredentialsFunction().createBuildStepFromFunctionCall(globalCtx),
    configureAndroidVersionFunction().createBuildStepFromFunctionCall(globalCtx),
    runGradle.createBuildStepFromFunctionCall(globalCtx, { id: runGradle.id }),
    createFindAndUploadBuildArtifactsBuildFunction(
      buildToolsContext
    ).createBuildStepFromFunctionCall(globalCtx),
  ];
}
