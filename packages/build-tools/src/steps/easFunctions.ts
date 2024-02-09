import { BuildFunction } from '@expo/steps';

import { CustomBuildContext } from '../customBuildContext';

import { createUploadArtifactBuildFunction } from './functions/uploadArtifact';
import { createCheckoutBuildFunction } from './functions/checkout';
import { createSetUpNpmrcBuildFunction } from './functions/useNpmToken';
import { createInstallNodeModulesBuildFunction } from './functions/installNodeModules';
import { createPrebuildBuildFunction } from './functions/prebuild';
import { createFindAndUploadBuildArtifactsBuildFunction } from './functions/findAndUploadBuildArtifacts';
import { configureEASUpdateIfInstalledFunction } from './functions/configureEASUpdateIfInstalled';
import { injectAndroidCredentialsFunction } from './functions/injectAndroidCredentials';
import { configureAndroidVersionFunction } from './functions/configureAndroidVersion';
import { runGradleFunction } from './functions/runGradle';
import { resolveAppleTeamIdFromCredentialsFunction } from './functions/resolveAppleTeamIdFromCredentials';
import { configureIosCredentialsFunction } from './functions/configureIosCredentials';
import { configureIosVersionFunction } from './functions/configureIosVersion';
import { generateGymfileFromTemplateFunction } from './functions/generateGymfileFromTemplate';
import { runFastlaneFunction } from './functions/runFastlane';
import { createStartAndroidEmulatorBuildFunction } from './functions/startAndroidEmulator';
import { createStartIosSimulatorBuildFunction } from './functions/startIosSimulator';
import { createInstallMaestroBuildFunction } from './functions/installMaestro';
import { createGetCredentialsForBuildTriggeredByGithubIntegration } from './functions/getCredentialsForBuildTriggeredByGitHubIntegration';
import { createInstallPodsBuildFunction } from './functions/installPods';
import { createSendSlackMessageFunction } from './functions/sendSlackMessage';

export function getEasFunctions(ctx: CustomBuildContext): BuildFunction[] {
  return [
    createCheckoutBuildFunction(),
    createUploadArtifactBuildFunction(ctx),
    createSetUpNpmrcBuildFunction(),
    createInstallNodeModulesBuildFunction(),
    createPrebuildBuildFunction(),
    createFindAndUploadBuildArtifactsBuildFunction(ctx),
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
    createGetCredentialsForBuildTriggeredByGithubIntegration(ctx),
    createInstallPodsBuildFunction(),
    createSendSlackMessageFunction(),
  ];
}
