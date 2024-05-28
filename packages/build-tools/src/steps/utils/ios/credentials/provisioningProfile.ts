import crypto from 'crypto';
import os from 'os';
import path from 'path';

import { errors } from '@expo/eas-build-job';
import fs from 'fs-extra';
import plist from 'plist';
import { v4 as uuid } from 'uuid';
import { bunyan } from '@expo/logger';
import { spawnAsync } from '@expo/steps';

export interface ProvisioningProfileData {
  path: string;
  target: string;
  bundleIdentifier: string;
  teamId: string;
  uuid: string;
  name: string;
  developerCertificate: Buffer;
  certificateCommonName: string;
  distributionType: DistributionType;
}

export enum DistributionType {
  AD_HOC = 'ad-hoc',
  APP_STORE = 'app-store',
  ENTERPRISE = 'enterprise',
}

const PROVISIONING_PROFILES_DIRECTORY = path.join(
  os.homedir(),
  'Library/MobileDevice/Provisioning Profiles'
);

export default class ProvisioningProfile {
  get data(): ProvisioningProfileData {
    if (!this.profileData) {
      throw new Error('You must init the profile first!');
    } else {
      return this.profileData;
    }
  }

  private readonly profilePath: string;
  private profileData?: ProvisioningProfileData;

  constructor(
    private readonly profile: Buffer,
    private readonly keychainPath: string,
    private readonly target: string,
    private readonly certificateCommonName: string
  ) {
    this.profilePath = path.join(PROVISIONING_PROFILES_DIRECTORY, `${uuid()}.mobileprovision`);
  }

  public async init(logger: bunyan): Promise<void> {
    logger.debug(`Making sure ${PROVISIONING_PROFILES_DIRECTORY} exits`);
    await fs.ensureDir(PROVISIONING_PROFILES_DIRECTORY);

    logger.debug(`Writing provisioning profile to ${this.profilePath}`);
    await fs.writeFile(this.profilePath, this.profile);

    logger.debug('Loading provisioning profile');
    await this.load();
  }

  public async destroy(logger: bunyan): Promise<void> {
    if (!this.profilePath) {
      logger.warn("There is nothing to destroy, a provisioning profile hasn't been created yet.");
      return;
    }
    logger.info('Removing provisioning profile');
    await fs.remove(this.profilePath);
  }

  public verifyCertificate(fingerprint: string): void {
    const devCertFingerprint = this.genDerCertFingerprint();
    if (devCertFingerprint !== fingerprint) {
      throw new errors.CredentialsDistCertMismatchError(
        `Provisioning profile and distribution certificate don't match.
Profile's certificate fingerprint = ${devCertFingerprint}, distribution certificate fingerprint = ${fingerprint}`
      );
    }
  }

  private async load(): Promise<void> {
    let result;
    try {
      result = await spawnAsync(
        'security',
        ['cms', '-D', '-k', this.keychainPath, '-i', this.profilePath],
        {
          stdio: 'pipe',
        }
      );
    } catch (err: any) {
      throw new Error(err.stderr.trim());
    }
    const { output } = result;

    const plistRaw = output.join('');
    let plistData;
    try {
      plistData = plist.parse(plistRaw) as plist.PlistObject;
    } catch (error: any) {
      throw new Error(`Error when parsing plist: ${error.message}`);
    }

    const applicationIdentifier = (plistData.Entitlements as plist.PlistObject)[
      'application-identifier'
    ] as string;
    const bundleIdentifier = applicationIdentifier.replace(/^.+?\./, '');

    this.profileData = {
      path: this.profilePath,
      target: this.target,
      bundleIdentifier,
      teamId: (plistData.TeamIdentifier as string[])[0],
      uuid: plistData.UUID as string,
      name: plistData.Name as string,
      developerCertificate: Buffer.from((plistData.DeveloperCertificates as string[])[0], 'base64'),
      certificateCommonName: this.certificateCommonName,
      distributionType: this.resolveDistributionType(plistData),
    };
  }

  private resolveDistributionType(plistData: plist.PlistObject): DistributionType {
    if (plistData.ProvisionsAllDevices) {
      return DistributionType.ENTERPRISE;
    } else if (plistData.ProvisionedDevices) {
      return DistributionType.AD_HOC;
    } else {
      return DistributionType.APP_STORE;
    }
  }

  private genDerCertFingerprint(): string {
    return crypto
      .createHash('sha1')
      .update(this.data.developerCertificate)
      .digest('hex')
      .toUpperCase();
  }
}
