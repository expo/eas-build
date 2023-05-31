import assert from 'assert';

import { createLogger } from '@expo/logger';
import { Ios, Workflow, ArchiveSourceType, Platform } from '@expo/eas-build-job';
import { BuildMode, BuildTrigger } from '@expo/eas-build-job/dist/common';

import { BuildContext } from '../../../context';
import { distributionCertificate, provisioningProfile } from '../__tests__/fixtures';
import { getIosCredentialsManager } from '../manager';

jest.setTimeout(60 * 1000);

const mockLogger = createLogger({ name: 'mock-logger' });

const iosCredentials: Ios.BuildCredentials = {
  testapp: {
    provisioningProfileBase64: '',
    distributionCertificate: {
      dataBase64: '',
      password: '',
    },
  },
};

function createTestIosJob({
  buildCredentials = iosCredentials,
}: {
  buildCredentials?: Ios.BuildCredentials;
} = {}): Ios.Job {
  return {
    mode: BuildMode.BUILD,
    platform: Platform.IOS,
    triggeredBy: BuildTrigger.EAS_CLI,
    type: Workflow.GENERIC,
    projectArchive: {
      type: ArchiveSourceType.URL,
      url: 'https://turtle-v2-test-fixtures.s3.us-east-2.amazonaws.com/project.tar.gz',
    },
    scheme: 'turtlebareproj',
    buildConfiguration: 'Release',
    applicationArchivePath: './ios/build/*.ipa',
    projectRootDirectory: '.',
    cache: {
      clear: false,
      disabled: false,
      paths: [],
    },
    secrets: {
      buildCredentials,
    },
  };
}

describe('IosCredentialsManager', () => {
  describe('.prepare', () => {
    it('should prepare credentials for the build process', async () => {
      const targetName = 'testapp';
      const job = createTestIosJob({
        buildCredentials: {
          [targetName]: {
            distributionCertificate,
            provisioningProfileBase64: provisioningProfile.dataBase64,
          },
        },
      });
      const ctx = new BuildContext(job, {
        workingdir: '/workingdir',
        logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
        logger: mockLogger,
        env: {},
        runGlobalExpoCliCommand: jest.fn(),
        uploadArtifacts: jest.fn(),
      });
      const manager = getIosCredentialsManager();
      const credentials = await manager.prepare(ctx, ctx.logger);
      await manager.cleanUp();

      assert(credentials, 'credentials must be defined');

      expect(credentials.teamId).toBe('QL76XYH73P');
      expect(credentials.distributionType).toBe('app-store');

      const profile = credentials.targetProvisioningProfiles[targetName];
      expect(profile.bundleIdentifier).toBe('org.reactjs.native.example.testapp.turtlev2.test');
      expect(profile.distributionType).toBe('app-store');
      expect(profile.teamId).toBe('QL76XYH73P');
    });
  });
});
