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
  for (const targetName of targetNames) {
    const profile = credentials.targetProvisioningProfiles[targetName];
    ctx.logger.info(
      `Assigning provisioning profile '${profile.name}' (Apple Team ID: ${profile.teamId}) to target '${targetName}'`
    );
    IOSConfig.ProvisioningProfile.setProvisioningProfileForPbxproj(
      ctx.reactNativeProjectDirectory,
      {
        targetName,
        profileName: profile.name,
        appleTeamId: profile.teamId,
      }
    );
  }
}

export { configureXcodeProject };
