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

export const mockAndroidCredentials: AndroidCredentials = {
  keystore: {
    keystorePath: 'mock-path',
    keystorePassword: 'mock-password',
    keyAlias: 'mock-alias',
    keyPassword: 'mock-password',
  },
};

export const mockIosCredentials: IosCredentials = {
  teamId: 'mock-team-id',
  keychainPath: 'mock-keychain-path',
  distributionType: DistributionType.APP_STORE,
  targetProvisioningProfiles: {
    anyString: {
      path: 'mock-path',
      target: 'mock-target',
      bundleIdentifier: 'mock-bundle-identifier',
      teamId: 'mock-team-id',
      uuid: 'mock-uuid',
      name: 'mock-name',
      developerCertificate: Buffer.from('mock-certificate'),
      certificateCommonName: 'mock-certificate-common-name',
      distributionType: DistributionType.APP_STORE,
    },
  },
  applicationTargetProvisioningProfile: {
    path: 'mock-path',
    target: 'mock-target',
    bundleIdentifier: 'mock-bundle-identifier',
    teamId: 'mock-team-id',
    uuid: 'mock-uuid',
    name: 'mock-name',
    developerCertificate: Buffer.from('mock-certificate'),
    certificateCommonName: 'mock-certificate-common-name',
    distributionType: DistributionType.APP_STORE,
  },
};

export const fullEasContext: EasContext = {
  credentials: {
    android: mockAndroidCredentials,
    ios: mockIosCredentials,
  },
};

export function getAllReachablePathsInEasContextObject(): RegExp[] {
  const reachablePaths: RegExp[] = [];
  function traverse(obj: any, path: RegExp[] = []): void {
    if (typeof obj !== 'object' || obj === null || Buffer.isBuffer(obj)) {
      reachablePaths.push(
        path.reduce(
          (acc, curr) =>
            new RegExp(
              `${acc.source.replace('anyString', '[\\S]+')}\\.${curr.source.replace(
                'anyString',
                '[\\S]+'
              )}`
            )
        )
      );
      return;
    }
    for (const key of Object.keys(obj)) {
      traverse(obj[key], [...path, RegExp(key)]);
    }
  }
  traverse(fullEasContext);
  return reachablePaths;
}
