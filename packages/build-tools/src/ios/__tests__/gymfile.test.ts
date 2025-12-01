import path from 'path';
import { vol } from 'memfs';

import { createGymfileForArchiveBuild, createGymfileForSimulatorBuild } from '../gymfile';
import { Credentials } from '../credentials/manager';

jest.mock('fs-extra');

const originalFs = jest.requireActual('fs');

// Read actual template files from the templates directory
const ARCHIVE_TEMPLATE = originalFs.readFileSync(
  path.join(__dirname, '../../../templates/Gymfile.archive.template'),
  'utf-8'
);

const SIMULATOR_TEMPLATE = originalFs.readFileSync(
  path.join(__dirname, '../../../templates/Gymfile.simulator.template'),
  'utf-8'
);

describe('gymfile', () => {
  beforeEach(() => {
    vol.reset();
    // Set up template files in the mock filesystem
    vol.fromJSON({
      [path.join(__dirname, '../../../templates/Gymfile.archive.template')]: ARCHIVE_TEMPLATE,
      [path.join(__dirname, '../../../templates/Gymfile.simulator.template')]: SIMULATOR_TEMPLATE,
    });
  });

  afterEach(() => {
    vol.reset();
  });

  describe('createGymfileForArchiveBuild', () => {
    it('should create Gymfile with all variables substituted correctly', async () => {
      const mockCredentials: Credentials = {
        keychainPath: '/Users/expo/Library/Keychains/login.keychain',
        distributionType: 'app-store',
        targetProvisioningProfiles: {
          'com.example.app': {
            bundleIdentifier: 'com.example.app',
            uuid: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
            path: '/path/to/profile1.mobileprovision',
          },
          'com.example.app.widget': {
            bundleIdentifier: 'com.example.app.widget',
            uuid: 'ffffffff-0000-1111-2222-333333333333',
            path: '/path/to/profile2.mobileprovision',
          },
        },
      };

      const outputFile = '/tmp/Gymfile';

      await createGymfileForArchiveBuild({
        outputFile,
        credentials: mockCredentials,
        scheme: 'MyApp',
        buildConfiguration: 'Release',
        outputDirectory: '/tmp/output',
        clean: true,
        logsDirectory: '/tmp/logs',
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      // Verify the generated content has all variables substituted
      expect(generatedContent).toContain('suppress_xcode_output(true)');
      expect(generatedContent).toContain('clean(true)');
      expect(generatedContent).toContain('scheme("MyApp")');
      expect(generatedContent).toContain('configuration("Release")');
      expect(generatedContent).toContain('method: "app-store"');
      expect(generatedContent).toContain(
        '"com.example.app" => "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"'
      );
      expect(generatedContent).toContain(
        '"com.example.app.widget" => "ffffffff-0000-1111-2222-333333333333"'
      );
      expect(generatedContent).toContain(
        'export_xcargs "OTHER_CODE_SIGN_FLAGS=\\"--keychain /Users/expo/Library/Keychains/login.keychain\\""'
      );
      expect(generatedContent).toContain('buildlog_path("/tmp/logs")');
      expect(generatedContent).toContain('output_directory("/tmp/output")');

      // Should not have any template variables remaining
      expect(generatedContent).not.toContain('<%');
      expect(generatedContent).not.toContain('%>');
      expect(generatedContent).not.toContain('KEYCHAIN_PATH');
      expect(generatedContent).not.toContain('SCHEME');
      expect(generatedContent).not.toContain('EXPORT_METHOD');
    });

    it('should create Gymfile without build configuration when not provided', async () => {
      const mockCredentials: Credentials = {
        keychainPath: '/tmp/keychain',
        distributionType: 'ad-hoc',
        targetProvisioningProfiles: {
          'com.example.app': {
            bundleIdentifier: 'com.example.app',
            uuid: 'test-uuid',
            path: '/path/to/profile.mobileprovision',
          },
        },
      };

      const outputFile = '/tmp/Gymfile';

      await createGymfileForArchiveBuild({
        outputFile,
        credentials: mockCredentials,
        scheme: 'TestScheme',
        outputDirectory: '/tmp/output',
        clean: false,
        logsDirectory: '/tmp/logs',
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      expect(generatedContent).toContain('scheme("TestScheme")');
      expect(generatedContent).toContain('clean(false)');
      expect(generatedContent).toContain('method: "ad-hoc"');
      // Should not have configuration line when buildConfiguration is undefined
      expect(generatedContent).not.toContain('configuration(');
    });

    it('should include iCloud container environment when provided in entitlements', async () => {
      const mockCredentials: Credentials = {
        keychainPath: '/tmp/keychain',
        distributionType: 'app-store',
        targetProvisioningProfiles: {
          'com.example.app': {
            bundleIdentifier: 'com.example.app',
            uuid: 'test-uuid',
            path: '/path/to/profile.mobileprovision',
          },
        },
      };

      const outputFile = '/tmp/Gymfile';

      await createGymfileForArchiveBuild({
        outputFile,
        credentials: mockCredentials,
        scheme: 'MyApp',
        buildConfiguration: 'Release',
        outputDirectory: '/tmp/output',
        clean: true,
        logsDirectory: '/tmp/logs',
        entitlements: {
          'com.apple.developer.icloud-container-environment': 'Production',
        },
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      expect(generatedContent).toContain('iCloudContainerEnvironment: "Production"');
    });

    it('should not include iCloud container environment when not in entitlements', async () => {
      const mockCredentials: Credentials = {
        keychainPath: '/tmp/keychain',
        distributionType: 'app-store',
        targetProvisioningProfiles: {
          'com.example.app': {
            bundleIdentifier: 'com.example.app',
            uuid: 'test-uuid',
            path: '/path/to/profile.mobileprovision',
          },
        },
      };

      const outputFile = '/tmp/Gymfile';

      await createGymfileForArchiveBuild({
        outputFile,
        credentials: mockCredentials,
        scheme: 'MyApp',
        outputDirectory: '/tmp/output',
        clean: true,
        logsDirectory: '/tmp/logs',
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      expect(generatedContent).not.toContain('iCloudContainerEnvironment');
    });

    it('should handle multiple provisioning profiles correctly', async () => {
      const mockCredentials: Credentials = {
        keychainPath: '/tmp/keychain',
        distributionType: 'enterprise',
        targetProvisioningProfiles: {
          'com.example.app': {
            bundleIdentifier: 'com.example.app',
            uuid: 'main-app-uuid',
            path: '/path/to/main.mobileprovision',
          },
          'com.example.app.widget': {
            bundleIdentifier: 'com.example.app.widget',
            uuid: 'widget-uuid',
            path: '/path/to/widget.mobileprovision',
          },
          'com.example.app.extension': {
            bundleIdentifier: 'com.example.app.extension',
            uuid: 'extension-uuid',
            path: '/path/to/extension.mobileprovision',
          },
        },
      };

      const outputFile = '/tmp/Gymfile';

      await createGymfileForArchiveBuild({
        outputFile,
        credentials: mockCredentials,
        scheme: 'MyApp',
        outputDirectory: '/tmp/output',
        clean: true,
        logsDirectory: '/tmp/logs',
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      expect(generatedContent).toContain('method: "enterprise"');
      expect(generatedContent).toContain('"com.example.app" => "main-app-uuid"');
      expect(generatedContent).toContain('"com.example.app.widget" => "widget-uuid"');
      expect(generatedContent).toContain('"com.example.app.extension" => "extension-uuid"');
    });
  });

  describe('createGymfileForSimulatorBuild', () => {
    it('should create Gymfile with all simulator variables substituted correctly', async () => {
      const outputFile = '/tmp/Gymfile';

      await createGymfileForSimulatorBuild({
        outputFile,
        scheme: 'MyApp',
        buildConfiguration: 'Debug',
        derivedDataPath: '/tmp/derived-data',
        clean: true,
        logsDirectory: '/tmp/logs',
        simulatorDestination: 'generic/platform=iOS Simulator',
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      // Verify all variables are substituted
      expect(generatedContent).toContain('suppress_xcode_output(true)');
      expect(generatedContent).toContain('clean(true)');
      expect(generatedContent).toContain('scheme("MyApp")');
      expect(generatedContent).toContain('configuration("Debug")');
      expect(generatedContent).toContain('derived_data_path("/tmp/derived-data")');
      expect(generatedContent).toContain('skip_package_ipa(true)');
      expect(generatedContent).toContain('skip_archive(true)');
      expect(generatedContent).toContain('destination("generic/platform=iOS Simulator")');
      expect(generatedContent).toContain('disable_xcpretty(true)');
      expect(generatedContent).toContain('buildlog_path("/tmp/logs")');

      // Should not have any template variables remaining
      expect(generatedContent).not.toContain('<%');
      expect(generatedContent).not.toContain('%>');
      expect(generatedContent).not.toContain('SCHEME');
      expect(generatedContent).not.toContain('DERIVED_DATA_PATH');
    });

    it('should create Gymfile without configuration when not provided', async () => {
      const outputFile = '/tmp/Gymfile';

      await createGymfileForSimulatorBuild({
        outputFile,
        scheme: 'TestApp',
        derivedDataPath: '/tmp/derived',
        clean: false,
        logsDirectory: '/tmp/logs',
        simulatorDestination: 'platform=iOS Simulator,name=iPhone 15',
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      expect(generatedContent).toContain('scheme("TestApp")');
      expect(generatedContent).toContain('clean(false)');
      expect(generatedContent).toContain('destination("platform=iOS Simulator,name=iPhone 15")');
      // Should not have configuration line when buildConfiguration is undefined
      expect(generatedContent).not.toContain('configuration(');
    });

    it('should handle tvOS simulator destination', async () => {
      const outputFile = '/tmp/Gymfile';

      await createGymfileForSimulatorBuild({
        outputFile,
        scheme: 'MyTVApp',
        buildConfiguration: 'Debug',
        derivedDataPath: '/tmp/derived',
        clean: true,
        logsDirectory: '/tmp/logs',
        simulatorDestination: 'generic/platform=tvOS Simulator',
      });

      const generatedContent = vol.readFileSync(outputFile, 'utf-8') as string;

      expect(generatedContent).toContain('destination("generic/platform=tvOS Simulator")');
    });
  });
});
