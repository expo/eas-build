import os from 'os';
import path from 'path';

import { Ios } from '@expo/eas-build-job';
import { createLogger } from '@expo/logger';
import fs from 'fs-extra';

import { BuildContext } from '../../../context';
import Keychain from '../keychain';

import { distributionCertificateValid } from './fixtures';

const mockLogger = createLogger({ name: 'mock-logger' });

jest.setTimeout(60 * 1000);

let ctx: BuildContext<Ios.Job>;

describe('Keychain class', () => {
  describe('ensureCertificateImported method', () => {
    let keychain: Keychain<Ios.Job>;
    const certificatePath = path.join(os.tmpdir(), 'cert.p12');

    beforeAll(async () => {
      await fs.writeFile(
        certificatePath,
        Buffer.from(distributionCertificateValid.dataBase64, 'base64')
      );
    });

    afterAll(async () => {
      await fs.remove(certificatePath);
    });

    beforeEach(async () => {
      ctx = new BuildContext({ projectRootDirectory: '.' } as Ios.Job, {
        workingdir: '/workingdir',
        logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
        logger: mockLogger,
        env: {},
      });
      keychain = new Keychain(ctx);
      await keychain.create();
    });

    afterEach(async () => {
      await keychain.destroy();
    });

    it("should throw an error if the certificate hasn't been imported", async () => {
      await expect(
        keychain.ensureCertificateImported(
          distributionCertificateValid.teamId,
          distributionCertificateValid.fingerprint
        )
      ).rejects.toThrowError(/hasn't been imported successfully/);
    });

    it("shouldn't throw any error if the certificate has been imported successfully", async () => {
      await keychain.importCertificate(certificatePath, distributionCertificateValid.password);
      await expect(
        keychain.ensureCertificateImported(
          distributionCertificateValid.teamId,
          distributionCertificateValid.fingerprint
        )
      ).resolves.not.toThrow();
    });
  });
});
