import assert from 'assert';
import { randomUUID } from 'crypto';

import { ArchiveSourceType, Ios, Platform, Workflow } from '@expo/eas-build-job';
import { BuildMode, BuildTrigger } from '@expo/eas-build-job/dist/common';
import { createLogger } from '@expo/logger';

import { BuildContext } from '../../../context';
import { distributionCertificate, provisioningProfile } from '../__tests__/fixtures';
import IosCredentialsManager from '../manager';

jest.setTimeout(60 * 1000);

jest.mock('@expo/turtle-spawn');

// Those are in fact "real" tests in that they really execute the `fastlane` commands.
// We need the JS code to modify the file system, so we need to mock it.
jest.unmock('fs');

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
    appId: randomUUID(),
    initiatingUserId: randomUUID(),
  };
}

describe(IosCredentialsManager, () => {
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
        uploadArtifact: jest.fn(),
      });
      const manager = new IosCredentialsManager(ctx);
      const credentials = await manager.prepare();
      await manager.cleanUp();

      assert(credentials, 'credentials must be defined');

      expect(credentials.teamId).toBe('SELFSIGNED');
      expect(credentials.distributionType).toBe('ad-hoc');

      const profile = credentials.targetProvisioningProfiles[targetName];
      expect(profile.bundleIdentifier).toBe('com.example.myapp');
      expect(profile.distributionType).toBe('ad-hoc');
      expect(profile.teamId).toBe('SELFSIGNED');
    });
  });
});
