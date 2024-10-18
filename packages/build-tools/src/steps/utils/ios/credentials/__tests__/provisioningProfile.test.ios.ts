import { Ios } from '@expo/eas-build-job';
import { createLogger } from '@expo/logger';

import Keychain from '../keychain';
import ProvisioningProfile from '../provisioningProfile';

import { provisioningProfile } from './fixtures';

const mockLogger = createLogger({ name: 'mock-logger' });

jest.setTimeout(60 * 1000);

describe('ProvisioningProfile class', () => {
  describe('verifyCertificate method', () => {
    let keychain: Keychain;

    beforeAll(async () => {
      keychain = new Keychain();
      await keychain.create(mockLogger);
    });

    afterAll(async () => {
      await keychain.destroy(mockLogger);
    });

    it("shouldn't throw any error if the provisioning profile and distribution certificate match", async () => {
      const pp = new ProvisioningProfile({
        profile: Buffer.from(provisioningProfile.dataBase64, 'base64'),
        keychainPath: keychain.data.path,
        target: 'testapp',
        certificateCommonName: 'Abc 123',
        profileType: Ios.ProvisioningProfileType.MOBILEPROVISION,
      });
      try {
        await pp.init(mockLogger);
        expect(() => {
          pp.verifyCertificate(provisioningProfile.certFingerprint);
        }).not.toThrow();
      } finally {
        await pp.destroy(mockLogger);
      }
    });

    it("should throw an error if the provisioning profile and distribution certificate don't match", async () => {
      const pp = new ProvisioningProfile({
        profile: Buffer.from(provisioningProfile.dataBase64, 'base64'),
        keychainPath: keychain.data.path,
        target: 'testapp',
        certificateCommonName: 'Abc 123',
        profileType: Ios.ProvisioningProfileType.MOBILEPROVISION,
      });

      try {
        await pp.init(mockLogger);
        expect(() => {
          pp.verifyCertificate('2137');
        }).toThrowError(/don't match/);
      } finally {
        await pp.destroy(mockLogger);
      }
    });
  });
});
