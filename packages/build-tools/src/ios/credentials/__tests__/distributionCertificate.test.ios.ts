import { getFingerprint } from '../distributionCertificate';

import { distributionCertificate } from './fixtures';

describe('distributionCertificate module', () => {
  describe('getFingerprint function', () => {
    it('calculates the certificate fingerprint', () => {
      const fingerprint = getFingerprint({
        dataBase64: distributionCertificate.dataBase64,
        password: distributionCertificate.password,
      });
      expect(fingerprint).toEqual(distributionCertificate.fingerprint);
    });

    it('should throw an error if the password is incorrect', () => {
      expect(() => {
        getFingerprint({
          dataBase64: distributionCertificate.dataBase64,
          password: 'incorrect',
        });
      }).toThrowError(/password.*invalid/);
    });
  });
});
