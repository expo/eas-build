import { Ios } from '@expo/eas-build-job';
import { IOSConfig } from '@expo/config-plugins';

import { BuildContext } from '../context';

// Functions specific to Apple TV support should be added here

/**
 * Use XcodeUtils to check if a build configuration is for Apple TV and not iOS
 *
 * @param ctx The build context
 * @param buildConfiguration The build configuration selected (usually "Release")
 * @returns true if this is an Apple TV configuration, false otherwise
 */
export function isTVOS(
  ctx: BuildContext<Ios.Job>,
  buildConfiguration: string
): boolean {
  if (ctx.job.scheme) {
    const project = IOSConfig.XcodeUtils.getPbxproj(ctx.reactNativeProjectDirectory);

    const xcBuildConfiguration = IOSConfig.Target.getXCBuildConfigurationFromPbxproj(project, {
      targetName: ctx.job.scheme,
      buildConfiguration,
    });
    return xcBuildConfiguration?.buildSettings?.SDKROOT?.includes('appletv');
  } else {
    return false;
  }
}
