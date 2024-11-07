import { vol } from 'memfs';
import fs from 'fs-extra';

import { diffFingerprintsAsync } from '../diffFingerprintsAsync';
import { isModernExpoFingerprintCLISupportedAsync } from '../expoFingerprintCli';

jest.mock('../expoFingerprintCli', () => ({
  ...jest.requireActual('../expoFingerprintCli'),
  expoFingerprintCommandAsync: jest.fn(),
  isModernExpoFingerprintCLISupportedAsync: jest.fn(),
}));

jest.mock('fs');

describe(diffFingerprintsAsync, () => {
  beforeEach(async () => {
    vol.reset();
  });

  it('falls back to local when CLI command fails', async () => {
    await fs.mkdirp('test');
    await fs.writeFile(
      'test/fp1',
      Buffer.from(
        JSON.stringify({
          sources: [
            {
              type: 'file',
              filePath: './assets/images/adaptive-icon.png',
              reasons: ['expoConfigExternalFile'],
              hash: '19b53640a95efdc2ccc7fc20f3ea4d0d381bb5c4',
            },
          ],
        })
      )
    );

    await fs.writeFile(
      'test/fp2',
      Buffer.from(
        JSON.stringify({
          sources: [
            {
              type: 'file',
              filePath: './assets/images/adaptive-icon.png',
              reasons: ['expoConfigExternalFile'],
              hash: '19b53640a95efdc2ccc7fc20f3ea4d0d381bb5c5',
            },
          ],
        })
      )
    );

    jest.mocked(isModernExpoFingerprintCLISupportedAsync).mockResolvedValue(false);

    const diff = await diffFingerprintsAsync('test', 'test/fp1', 'test/fp2', {
      env: {},
      logger: { debug: jest.fn() } as any,
    });
    expect(diff).toEqual(
      JSON.stringify([
        {
          op: 'changed',
          beforeSource: {
            type: 'file',
            filePath: './assets/images/adaptive-icon.png',
            reasons: ['expoConfigExternalFile'],
            hash: '19b53640a95efdc2ccc7fc20f3ea4d0d381bb5c4',
          },
          afterSource: {
            type: 'file',
            filePath: './assets/images/adaptive-icon.png',
            reasons: ['expoConfigExternalFile'],
            hash: '19b53640a95efdc2ccc7fc20f3ea4d0d381bb5c5',
          },
        },
      ])
    );
  });
});
