import { BuildFunction } from '@expo/steps';

import { CustomBuildContext } from '../customBuildContext';

import { createRestoreCacheBuildFunction, createSaveCacheBuildFunction } from './functions/cache';
import { calculateEASUpdateRuntimeVersionFunction } from './functions/calculateEASUpdateRuntimeVersion';
import { createCheckoutBuildFunction } from './functions/checkout';
import { configureAndroidVersionFunction } from './functions/configureAndroidVersion';
import { configureEASUpdateIfInstalledFunction } from './functions/configureEASUpdateIfInstalled';
import { configureIosCredentialsFunction } from './functions/configureIosCredentials';
import { configureIosVersionFunction } from './functions/configureIosVersion';
import { createFindAndUploadBuildArtifactsBuildFunction } from './functions/findAndUploadBuildArtifacts';
import { generateGymfileFromTemplateFunction } from './functions/generateGymfileFromTemplate';
import { createGetCredentialsForBuildTriggeredByGithubIntegration } from './functions/getCredentialsForBuildTriggeredByGitHubIntegration';
import { injectAndroidCredentialsFunction } from './functions/injectAndroidCredentials';
import { createInstallMaestroBuildFunction } from './functions/installMaestro';
import { createInstallNodeModulesBuildFunction } from './functions/installNodeModules';
import { createInstallPodsBuildFunction } from './functions/installPods';
import { createPrebuildBuildFunction } from './functions/prebuild';
import { resolveAppleTeamIdFromCredentialsFunction } from './functions/resolveAppleTeamIdFromCredentials';
import { createResolveBuildConfigBuildFunction } from './functions/resolveBuildConfig';
import { runFastlaneFunction } from './functions/runFastlane';
import { runGradleFunction } from './functions/runGradle';
import { createSendSlackMessageFunction } from './functions/sendSlackMessage';
import { createStartAndroidEmulatorBuildFunction } from './functions/startAndroidEmulator';
import { createStartIosSimulatorBuildFunction } from './functions/startIosSimulator';
import { createUploadArtifactBuildFunction } from './functions/uploadArtifact';
import { createSetUpNpmrcBuildFunction } from './functions/useNpmToken';

export function getEasFunctions(ctx: CustomBuildContext): BuildFunction[] {
  const functions = [
    createCheckoutBuildFunction(),
    createUploadArtifactBuildFunction(ctx),
    createSetUpNpmrcBuildFunction(),
    createInstallNodeModulesBuildFunction(),
    createPrebuildBuildFunction(),

    configureEASUpdateIfInstalledFunction(),
    injectAndroidCredentialsFunction(),
    configureAndroidVersionFunction(),
    runGradleFunction(),
    resolveAppleTeamIdFromCredentialsFunction(),
    configureIosCredentialsFunction(),
    configureIosVersionFunction(),
    generateGymfileFromTemplateFunction(),
    runFastlaneFunction(),
    createStartAndroidEmulatorBuildFunction(),
    createStartIosSimulatorBuildFunction(),
    createInstallMaestroBuildFunction(),

    createInstallPodsBuildFunction(),
    createSendSlackMessageFunction(),

    calculateEASUpdateRuntimeVersionFunction(ctx),
  ];

  if (ctx.hasBuildJob()) {
    functions.push(
      ...[
        createSaveCacheBuildFunction(ctx),
        createRestoreCacheBuildFunction(ctx),
        createFindAndUploadBuildArtifactsBuildFunction(ctx),
        createResolveBuildConfigBuildFunction(ctx),
        createGetCredentialsForBuildTriggeredByGithubIntegration(ctx),
      ]
    );
  }

  return functions;
}
