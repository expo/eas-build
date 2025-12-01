import path from 'path';
import { vol } from 'memfs';

import { createFastfileForResigningBuild } from '../fastfile';
import { TargetProvisioningProfiles } from '../credentials/manager';

jest.mock('fs-extra');

const originalFs = jest.requireActual('fs');

// Read actual template file from the templates directory
const RESIGN_TEMPLATE = originalFs.readFileSync(
  path.join(__dirname, '../../../templates/Fastfile.resign.template'),
  'utf-8'
);

describe('fastfile', () => {
  beforeEach(() => {
    vol.reset();
    // Set up template file in the mock filesystem
    vol.fromJSON({
      [path.join(__dirname, '../../../templates/Fastfile.resign.template')]: RESIGN_TEMPLATE,
    });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('createFastfileForResigningBuild', () => {
    it('should create Fastfile with all variables substituted correctly', async () => {
      const mockTargetProvisioningProfiles: TargetProvisioningProfiles = {
        'com.example.app': {
          bundleIdentifier: 'com.example.app',
          uuid: 'test-uuid-1',
          path: '/path/to/profiles/main.mobileprovision',
        },
        'com.example.app.widget': {
          bundleIdentifier: 'com.example.app.widget',
          uuid: 'test-uuid-2',
          path: '/path/to/profiles/widget.mobileprovision',
        },
      };

      const outputFile = '/tmp/Fastfile';

      await createFastfileForResigningBuild({
        outputFile,
        ipaPath: '/builds/MyApp.ipa',
        signingIdentity: 'iPhone Distribution: Example Inc (ABC123)',
        keychainPath: '/Users/expo/Library/Keychains/login.keychain',
        targetProvisioningProfiles: mockTargetProvisioningProfiles,
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      // Verify the generated content has all variables substituted
      expect(generatedContent).toContain('lane :do_resign do');
      expect(generatedContent).toContain('resign(');
      expect(generatedContent).toContain('ipa: "/builds/MyApp.ipa"');
      expect(generatedContent).toContain('signing_identity: "iPhone Distribution: Example Inc (ABC123)"');
      expect(generatedContent).toContain(
        '"com.example.app" => "/path/to/profiles/main.mobileprovision"'
      );
      expect(generatedContent).toContain(
        '"com.example.app.widget" => "/path/to/profiles/widget.mobileprovision"'
      );
      expect(generatedContent).toContain(
        'keychain_path: "/Users/expo/Library/Keychains/login.keychain"'
      );

      // Should not have any template variables remaining
      expect(generatedContent).not.toContain('<%');
      expect(generatedContent).not.toContain('%>');
      expect(generatedContent).not.toContain('IPA_PATH');
      expect(generatedContent).not.toContain('SIGNING_IDENTITY');
      expect(generatedContent).not.toContain('KEYCHAIN_PATH');
      expect(generatedContent).not.toContain('PROFILES');
    });

    it('should handle single provisioning profile', async () => {
      const mockTargetProvisioningProfiles: TargetProvisioningProfiles = {
        'com.example.app': {
          bundleIdentifier: 'com.example.app',
          uuid: 'single-uuid',
          path: '/tmp/profile.mobileprovision',
        },
      };

      const outputFile = '/tmp/Fastfile';

      await createFastfileForResigningBuild({
        outputFile,
        ipaPath: '/tmp/app.ipa',
        signingIdentity: 'iPhone Distribution',
        keychainPath: '/tmp/keychain',
        targetProvisioningProfiles: mockTargetProvisioningProfiles,
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      expect(generatedContent).toContain('ipa: "/tmp/app.ipa"');
      expect(generatedContent).toContain('signing_identity: "iPhone Distribution"');
      expect(generatedContent).toContain('"com.example.app" => "/tmp/profile.mobileprovision"');
      expect(generatedContent).toContain('keychain_path: "/tmp/keychain"');
    });

    it('should handle multiple provisioning profiles correctly', async () => {
      const mockTargetProvisioningProfiles: TargetProvisioningProfiles = {
        'com.example.app': {
          bundleIdentifier: 'com.example.app',
          uuid: 'uuid-main',
          path: '/profiles/main.mobileprovision',
        },
        'com.example.app.widget': {
          bundleIdentifier: 'com.example.app.widget',
          uuid: 'uuid-widget',
          path: '/profiles/widget.mobileprovision',
        },
        'com.example.app.extension': {
          bundleIdentifier: 'com.example.app.extension',
          uuid: 'uuid-extension',
          path: '/profiles/extension.mobileprovision',
        },
        'com.example.app.intents': {
          bundleIdentifier: 'com.example.app.intents',
          uuid: 'uuid-intents',
          path: '/profiles/intents.mobileprovision',
        },
      };

      const outputFile = '/tmp/Fastfile';

      await createFastfileForResigningBuild({
        outputFile,
        ipaPath: '/tmp/app.ipa',
        signingIdentity: 'iPhone Distribution: Company Name',
        keychainPath: '/tmp/keychain',
        targetProvisioningProfiles: mockTargetProvisioningProfiles,
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      // All profiles should be present
      expect(generatedContent).toContain('"com.example.app" => "/profiles/main.mobileprovision"');
      expect(generatedContent).toContain('"com.example.app.widget" => "/profiles/widget.mobileprovision"');
      expect(generatedContent).toContain('"com.example.app.extension" => "/profiles/extension.mobileprovision"');
      expect(generatedContent).toContain('"com.example.app.intents" => "/profiles/intents.mobileprovision"');
    });

    it('should handle empty provisioning profiles', async () => {
      const mockTargetProvisioningProfiles: TargetProvisioningProfiles = {};

      const outputFile = '/tmp/Fastfile';

      await createFastfileForResigningBuild({
        outputFile,
        ipaPath: '/tmp/app.ipa',
        signingIdentity: 'iPhone Distribution',
        keychainPath: '/tmp/keychain',
        targetProvisioningProfiles: mockTargetProvisioningProfiles,
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      // Should still have the basic structure
      expect(generatedContent).toContain('lane :do_resign do');
      expect(generatedContent).toContain('resign(');
      expect(generatedContent).toContain('ipa: "/tmp/app.ipa"');
      // Provisioning profile section should be empty
      expect(generatedContent).toContain('provisioning_profile: {');
    });

    it('should handle paths with special characters and spaces', async () => {
      const mockTargetProvisioningProfiles: TargetProvisioningProfiles = {
        'com.example.app': {
          bundleIdentifier: 'com.example.app',
          uuid: 'test-uuid',
          path: '/path/with spaces/profile (1).mobileprovision',
        },
      };

      const outputFile = '/tmp/Fastfile';

      await createFastfileForResigningBuild({
        outputFile,
        ipaPath: '/builds/My App (Release).ipa',
        signingIdentity: 'iPhone Distribution: Example Inc (ABC123XYZ)',
        keychainPath: '/Users/expo/Library/Keychains/login keychain.keychain',
        targetProvisioningProfiles: mockTargetProvisioningProfiles,
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      expect(generatedContent).toContain('ipa: "/builds/My App (Release).ipa"');
      expect(generatedContent).toContain('signing_identity: "iPhone Distribution: Example Inc (ABC123XYZ)"');
      expect(generatedContent).toContain(
        'keychain_path: "/Users/expo/Library/Keychains/login keychain.keychain"'
      );
      expect(generatedContent).toContain(
        '"com.example.app" => "/path/with spaces/profile (1).mobileprovision"'
      );
    });

    it('should produce valid Ruby syntax', async () => {
      const mockTargetProvisioningProfiles: TargetProvisioningProfiles = {
        'com.example.app': {
          bundleIdentifier: 'com.example.app',
          uuid: 'test-uuid',
          path: '/path/to/profile.mobileprovision',
        },
      };

      const outputFile = '/tmp/Fastfile';

      await createFastfileForResigningBuild({
        outputFile,
        ipaPath: '/tmp/app.ipa',
        signingIdentity: 'iPhone Distribution',
        keychainPath: '/tmp/keychain',
        targetProvisioningProfiles: mockTargetProvisioningProfiles,
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      // Check for proper Ruby syntax elements
      expect(generatedContent).toMatch(/lane :do_resign do/);
      expect(generatedContent).toMatch(/resign\(/);
      expect(generatedContent).toMatch(/\)/);
      expect(generatedContent).toMatch(/end/);
      // Should have proper key-value pairs
      expect(generatedContent).toMatch(/ipa: ".+"/);
      expect(generatedContent).toMatch(/signing_identity: ".+"/);
      expect(generatedContent).toMatch(/keychain_path: ".+"/);
    });
  });
});
