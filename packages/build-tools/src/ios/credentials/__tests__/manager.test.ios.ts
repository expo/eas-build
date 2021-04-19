import assert from 'assert';

import { jobs } from '@expo/turtle-test-utils';
import { createLogger } from '@expo/logger';

import { BuildContext } from '../../../context';
import { distributionCertificateValid, provisioningProfileValid } from '../__tests__/fixtures';
import IosCredentialsManager from '../manager';

jest.setTimeout(60 * 1000);

const mockLogger = createLogger({ name: 'mock-logger' });

describe(IosCredentialsManager, () => {
  describe('.prepare', () => {
    it('should prepare credentials for the build process', async () => {
      const targetName = 'testapp';
      const job = jobs.createTestIosJob({
        buildCredentials: {
          [targetName]: {
            distributionCertificate: distributionCertificateValid,
            provisioningProfileBase64: provisioningProfileValid.dataBase64,
          },
        },
      });
      const ctx = new BuildContext(job, {
        workingdir: '/workingdir',
        logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
        logger: mockLogger,
        env: {},
      });
      const manager = new IosCredentialsManager(ctx);
      const credentials = await manager.prepare();
      await manager.cleanUp();

      assert(credentials, 'credentials must be defined');

      expect(credentials.teamId).toBe('QL76XYH73P');
      expect(credentials.distributionType).toBe('app-store');

      const profile = credentials.targetProvisioningProfiles[targetName];
      expect(profile.bundleIdentifier).toBe('org.reactjs.native.example.testapp.turtlev2');
      expect(profile.distributionType).toBe('app-store');
      expect(profile.teamId).toBe('QL76XYH73P');
    });
  });
});
