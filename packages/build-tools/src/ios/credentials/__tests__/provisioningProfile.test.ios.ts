import { Ios } from '@expo/eas-build-job';
import { createLogger } from '@expo/logger';

import { BuildContext } from '../../../context';
import Keychain from '../keychain';
import ProvisioningProfile from '../provisioningProfile';

import { provisioningProfile } from './fixtures';

const mockLogger = createLogger({ name: 'mock-logger' });

jest.setTimeout(60 * 1000);

describe('ProvisioningProfile class', () => {
  describe('verifyCertificate method', () => {
    let ctx: BuildContext<Ios.Job>;
    let keychain: Keychain<Ios.Job>;

    beforeAll(async () => {
      ctx = new BuildContext({ projectRootDirectory: '.' } as Ios.Job, {
        workingdir: '/workingdir',
        logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
        logger: mockLogger,
        env: {},
        runGlobalExpoCliCommand: jest.fn(),
        uploadArtifacts: jest.fn(),
      });
      keychain = new Keychain(ctx);
      await keychain.create();
    });

    afterAll(async () => {
      await keychain.destroy();
    });

    it("shouldn't throw any error if the provisioning profile and distribution certificate match", async () => {
      const pp = new ProvisioningProfile(
        ctx,
        Buffer.from(provisioningProfile.dataBase64, 'base64'),
        keychain.data.path
      );
      try {
        await pp.init();
        expect(() => {
          pp.verifyCertificate(provisioningProfile.certFingerprint);
        }).not.toThrow();
      } finally {
        await pp.destroy();
      }
    });

    it("should throw an error if the provisioning profile and distribution certificate don't match", async () => {
      const pp = new ProvisioningProfile(
        ctx,
        Buffer.from(provisioningProfile.dataBase64, 'base64'),
        keychain.data.path
      );

      try {
        await pp.init();
        expect(() => {
          pp.verifyCertificate('2137');
        }).toThrowError(/don't match/);
      } finally {
        await pp.destroy();
      }
    });
  });
});
