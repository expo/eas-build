import { getAllReachablePathsInEasContextObject } from '../EasContext.js';

describe(getAllReachablePathsInEasContextObject, () => {
  it('returns all possible paths in the eas context object', () => {
    expect(getAllReachablePathsInEasContextObject()).toEqual([
      /credentials\.android\.keystore\.keystorePath/,
      /credentials\.android\.keystore\.keystorePassword/,
      /credentials\.android\.keystore\.keyAlias/,
      /credentials\.android\.keystore\.keyPassword/,
      /credentials\.ios\.teamId/,
      /credentials\.ios\.keychainPath/,
      /credentials\.ios\.distributionType/,
      /credentials\.ios\.targetProvisioningProfiles\.[\S]+\.path/,
      /credentials\.ios\.targetProvisioningProfiles\.[\S]+\.target/,
      /credentials\.ios\.targetProvisioningProfiles\.[\S]+\.bundleIdentifier/,
      /credentials\.ios\.targetProvisioningProfiles\.[\S]+\.teamId/,
      /credentials\.ios\.targetProvisioningProfiles\.[\S]+\.uuid/,
      /credentials\.ios\.targetProvisioningProfiles\.[\S]+\.name/,
      /credentials\.ios\.targetProvisioningProfiles\.[\S]+\.developerCertificate/,
      /credentials\.ios\.targetProvisioningProfiles\.[\S]+\.certificateCommonName/,
      /credentials\.ios\.targetProvisioningProfiles\.[\S]+\.distributionType/,
      /credentials\.ios\.applicationTargetProvisioningProfile\.path/,
      /credentials\.ios\.applicationTargetProvisioningProfile\.target/,
      /credentials\.ios\.applicationTargetProvisioningProfile\.bundleIdentifier/,
      /credentials\.ios\.applicationTargetProvisioningProfile\.teamId/,
      /credentials\.ios\.applicationTargetProvisioningProfile\.uuid/,
      /credentials\.ios\.applicationTargetProvisioningProfile\.name/,
      /credentials\.ios\.applicationTargetProvisioningProfile\.developerCertificate/,
      /credentials\.ios\.applicationTargetProvisioningProfile\.certificateCommonName/,
      /credentials\.ios\.applicationTargetProvisioningProfile\.distributionType/,
    ]);
  });
});
