import assert from 'assert';
import os from 'os';
import path from 'path';

import { Ios } from '@expo/eas-build-job';
import fs from 'fs-extra';
import { v4 as uuid } from 'uuid';

import { BuildContext } from '../../context';

import * as distributionCertificateUtils from './distributionCertificate';
import Keychain from './keychain';
import ProvisioningProfile, {
  DistributionType,
  ProvisioningProfileData,
} from './provisioningProfile';

export interface Credentials {
  keychainPath: string;
  targetProvisioningProfiles: TargetProvisioningProfiles;
  distributionType: DistributionType;
  teamId: string;
}

type TargetProvisioningProfiles = Record<string, ProvisioningProfileData>;

export default class IosCredentialsManager<TJob extends Ios.Job> {
  private keychain?: Keychain<TJob>;
  private readonly provisioningProfiles: ProvisioningProfile<TJob>[] = [];
  private cleanedUp = false;

  constructor(private readonly ctx: BuildContext<TJob>) {}

  public async prepare(): Promise<Credentials | null> {
    if (this.ctx.job.distribution === 'simulator') {
      return null;
    }

    const { buildCredentials } = this.ctx.job.secrets;
    if (!buildCredentials) {
      throw new Error('credentials are required for an iOS build');
    }

    this.ctx.logger.info('Preparing credentials');

    this.ctx.logger.info('Creating keychain');
    this.keychain = new Keychain(this.ctx);
    await this.keychain.create();

    const targets = Object.keys(buildCredentials);
    const targetProvisioningProfiles: TargetProvisioningProfiles = {};
    for (const target of targets) {
      const provisioningProfile = await this.prepareTargetCredentials(
        target,
        buildCredentials[target]
      );
      this.provisioningProfiles.push(provisioningProfile);
      targetProvisioningProfiles[target] = provisioningProfile.data;
    }

    // TODO: ensure that all dist types and team ids in the array are the same
    const { distributionType, teamId } = this.provisioningProfiles[0].data;

    return {
      keychainPath: this.keychain.data.path,
      targetProvisioningProfiles,
      distributionType,
      teamId,
    };
  }

  public async cleanUp(): Promise<void> {
    if (this.cleanedUp || (!this.keychain && this.provisioningProfiles.length === 0)) {
      return;
    }

    if (this.keychain) {
      await this.keychain.destroy();
    }
    if (this.provisioningProfiles) {
      for (const provisioningProfile of this.provisioningProfiles) {
        await provisioningProfile.destroy();
      }
    }
    this.cleanedUp = true;
  }

  private async prepareTargetCredentials(
    target: string,
    targetCredentials: Ios.TargetCredentials
  ): Promise<ProvisioningProfile<TJob>> {
    try {
      assert(this.keychain, 'Keychain should be initialized');

      this.ctx.logger.info(`Preparing credentials for target '${target}'`);
      const distCertPath = path.join(os.tmpdir(), `${uuid()}.p12`);

      this.ctx.logger.info('Getting distribution certificate fingerprint');
      const certificateFingerprint = distributionCertificateUtils.getFingerprint(
        targetCredentials.distributionCertificate
      );

      this.ctx.logger.info(`Writing distribution certificate to ${distCertPath}`);
      await fs.writeFile(
        distCertPath,
        Buffer.from(targetCredentials.distributionCertificate.dataBase64, 'base64')
      );

      this.ctx.logger.info('Importing distribution certificate into the keychain');
      await this.keychain.importCertificate(
        distCertPath,
        targetCredentials.distributionCertificate.password
      );

      this.ctx.logger.info('Initializing provisioning profile');
      const provisioningProfile = new ProvisioningProfile(
        this.ctx,
        Buffer.from(targetCredentials.provisioningProfileBase64, 'base64'),
        this.keychain.data.path
      );
      await provisioningProfile.init();

      this.ctx.logger.info(
        'Validating whether distribution certificate has been imported successfully'
      );
      await this.keychain.ensureCertificateImported(
        provisioningProfile.data.teamId,
        certificateFingerprint
      );

      this.ctx.logger.info(
        'Verifying whether the distribution certificate and provisioning profile match'
      );
      provisioningProfile.verifyCertificate(certificateFingerprint);

      return provisioningProfile;
    } catch (err) {
      await this.cleanUp();
      throw err;
    }
  }
}
