interface AndroidCredentials {
  keystore: {
    keystorePath: string;
    keystorePassword: string;
    keyAlias: string;
    keyPassword?: string;
  };
}

enum DistributionType {
  AD_HOC = 'ad-hoc',
  APP_STORE = 'app-store',
  ENTERPRISE = 'enterprise',
}
export interface ProvisioningProfileData {
  path: string;
  target: string;
  bundleIdentifier: string;
  teamId: string;
  uuid: string;
  name: string;
  developerCertificate: Buffer;
  certificateCommonName: string;
  distributionType: DistributionType;
}
type TargetProvisioningProfiles = Record<string, ProvisioningProfileData>;
interface IosCredentials {
  teamId: string;
  keychainPath: string;
  distributionType: DistributionType;
  targetProvisioningProfiles: TargetProvisioningProfiles;
  applicationTargetProvisioningProfile: ProvisioningProfileData;
}

export interface EasContext {
  credentials: {
    android?: AndroidCredentials;
    ios?: IosCredentials | null;
  };
}

export const emptyEasContext: EasContext = {
  credentials: {},
};
