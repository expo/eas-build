import os from 'os';
import path from 'path';

import fastlane from '@expo/fastlane';
import { Ios } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';
import { v4 as uuid } from 'uuid';

import { BuildContext } from '../../context';

class Keychain<TJob extends Ios.Job> {
  private readonly keychainPath: string;
  private readonly keychainPassword: string;
  private created = false;
  private destroyed = false;

  constructor(private readonly ctx: BuildContext<TJob>) {
    this.keychainPath = path.join(os.tmpdir(), `turtle-v2-${uuid()}.keychain`);
    this.keychainPassword = uuid();
  }

  get data(): { path: string; password: string } {
    return {
      path: this.keychainPath,
      password: this.keychainPassword,
    };
  }

  public async create(): Promise<void> {
    this.ctx.logger.debug(`Creating keychain - ${this.keychainPath}`);
    await fastlane([
      'run',
      'create_keychain',
      `path:${this.keychainPath}`,
      `password:${this.keychainPassword}`,
      'unlock:true',
      'timeout:360000',
    ]);
    this.created = true;
  }

  public async importCertificate(certPath: string, certPassword: string): Promise<void> {
    if (!this.created) {
      throw new Error('You must create a keychain first.');
    }

    this.ctx.logger.debug(`Importing certificate ${certPath} into keychain ${this.keychainPath}`);
    await fastlane([
      'run',
      'import_certificate',
      `certificate_path:${certPath}`,
      `certificate_password:${certPassword}`,
      `keychain_path:${this.keychainPath}`,
      `keychain_password:${this.keychainPassword}`,
    ]);
  }

  public async ensureCertificateImported(teamId: string, fingerprint: string): Promise<void> {
    const identities = await this.findIdentitiesByTeamId(teamId);
    if (!identities.includes(fingerprint)) {
      throw new Error(
        `Distribution certificate with fingerprint ${fingerprint} hasn't been imported successfully`
      );
    }
  }

  public async destroy(keychainPath?: string): Promise<void> {
    if (!keychainPath && !this.created) {
      this.ctx.logger.warn("There is nothing to destroy, a keychain hasn't been created yet.");
      return;
    }
    if (this.destroyed) {
      this.ctx.logger.warn('The keychain has been already destroyed');
      return;
    }
    const keychainToDeletePath = keychainPath ?? this.keychainPath;
    this.ctx.logger.info(`Destroying keychain - ${keychainToDeletePath}`);
    try {
      await fastlane(['run', 'delete_keychain', `keychain_path:${keychainToDeletePath}`]);
      this.destroyed = true;
    } catch (err) {
      this.ctx.logger.error({ err }, 'Failed to delete the keychain\n');
      throw err;
    }
  }

  public async cleanUpKeychains(): Promise<void> {
    const { stdout } = await spawn('security', ['list-keychains'], { stdio: 'pipe' });
    const keychainList = (/"(.*)"/g.exec(stdout) ?? ([] as string[])).map((i) =>
      i.slice(1, i.length - 1)
    );
    const turtleKeychainList = keychainList.filter((keychain) =>
      /turtle-v2-[\w-]+\.keychain$/.exec(keychain)
    );
    for (const turtleKeychainPath of turtleKeychainList) {
      await this.destroy(turtleKeychainPath);
    }
  }

  private async findIdentitiesByTeamId(teamId: string): Promise<string> {
    const { output } = await spawn(
      'security',
      ['find-identity', '-v', '-s', `(${teamId})`, this.keychainPath],
      {
        stdio: 'pipe',
      }
    );
    return output.join('');
  }
}

export default Keychain;
