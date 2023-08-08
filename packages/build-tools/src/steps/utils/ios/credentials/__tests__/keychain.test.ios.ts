import os from 'os';
import path from 'path';

import { createLogger } from '@expo/logger';
import fs from 'fs-extra';
import { v4 as uuid } from 'uuid';

import Keychain from '../keychain';

import { distributionCertificate } from './fixtures';

const mockLogger = createLogger({ name: 'mock-logger' });

jest.setTimeout(60 * 1000);

describe('Keychain class', () => {
  describe('ensureCertificateImported method', () => {
    let keychain: Keychain;
    const certificatePath = path.join(os.tmpdir(), `cert-${uuid()}.p12`);

    beforeAll(async () => {
      await fs.writeFile(
        certificatePath,
        Buffer.from(distributionCertificate.dataBase64, 'base64')
      );
    });

    afterAll(async () => {
      await fs.remove(certificatePath);
    });

    beforeEach(async () => {
      keychain = new Keychain();
      await keychain.create(mockLogger);
    });

    afterEach(async () => {
      await keychain.destroy(mockLogger);
    });

    it("should throw an error if the certificate hasn't been imported", async () => {
      await expect(
        keychain.ensureCertificateImported(
          distributionCertificate.teamId,
          distributionCertificate.fingerprint
        )
      ).rejects.toThrowError(/hasn't been imported successfully/);
    });

    it("shouldn't throw any error if the certificate has been imported successfully", async () => {
      await keychain.importCertificate(
        mockLogger,
        certificatePath,
        distributionCertificate.password
      );
      await expect(
        keychain.ensureCertificateImported(
          distributionCertificate.teamId,
          distributionCertificate.fingerprint
        )
      ).resolves.not.toThrow();
    });
  });
});
