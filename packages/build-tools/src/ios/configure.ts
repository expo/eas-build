import { IOSConfig } from '@expo/config-plugins';
import { Ios } from '@expo/eas-build-job';

import { BuildContext } from '../context';

import { Credentials } from './credentials/manager';

async function configureXcodeProject<TJob extends Ios.Job>(
  ctx: BuildContext<TJob>,
  credentials: Credentials
): Promise<void> {
  ctx.logger.info('Configuring Xcode project');
  const targetNames = Object.keys(credentials.targetProvisioningProfiles);
  // __eas_build_default_target__ is a temporary name
  // should match the value in turtle-api
  const onlyDefaultTarget =
    targetNames.length === 1 && targetNames[0] === '__eas_build_default_target__';
  for (const targetName of targetNames) {
    const profile = credentials.targetProvisioningProfiles[targetName];
    ctx.logger.info(
      `Assigning provisioning profile '${profile.name}' (Apple Team ID: ${profile.teamId}) to ${
        onlyDefaultTarget ? 'the default target' : `target '${targetName}'`
      }`
    );
    IOSConfig.ProvisioningProfile.setProvisioningProfileForPbxproj(
      ctx.reactNativeProjectDirectory,
      {
        targetName: onlyDefaultTarget ? undefined : targetName,
        profileName: profile.name,
        appleTeamId: profile.teamId,
      }
    );
  }
}

export { configureXcodeProject };
