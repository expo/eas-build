import path from 'path';

import { BuildMode, BuildPhase, errors, Job, Platform } from '@expo/eas-build-job';

import { resolveBuildPhaseErrorAsync } from '../detectError';

describe(resolveBuildPhaseErrorAsync, () => {
  it('detects log for corrupted npm package', async () => {
    const fakeError = new Error();
    const err = await resolveBuildPhaseErrorAsync(
      fakeError,
      [
        '[stderr] WARN tarball tarball data for @typescript-eslint/typescript-estree@5.26.0 (sha512-cozo/GbwixVR0sgfHItz3t1yXu521yn71Wj6PlYCFA3WPhy51CUPkifFKfBis91bDclGmAY45hhaAXVjdn4new==) seems to be corrupted. Trying again.',
      ],
      {
        job: { platform: Platform.ANDROID } as Job,
        phase: BuildPhase.INSTALL_DEPENDENCIES,
        env: {},
      },
      '/fake/path'
    );
    expect(err.errorCode).toBe('NPM_CORRUPTED_PACKAGE');
    expect(err.userFacingErrorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
  });

  it('detects log for invalid bundler and reports it to user', async () => {
    const fakeError = new Error();
    const err = await resolveBuildPhaseErrorAsync(
      fakeError,
      [
        "/System/Library/Frameworks/Ruby.framework/Versions/2.6/usr/lib/ruby/2.6.0/rubygems/dependency.rb:313:in `to_specs': Could not find 'bundler' (2.2.3) required by your /Users/expo/project/build/ios/Gemfile.lock. (Gem::MissingSpecVersionError)",
      ],
      {
        job: { platform: Platform.IOS } as Job,
        phase: BuildPhase.RUN_FASTLANE,
        env: {},
      },
      '/fake/path'
    );
    expect(err.errorCode).toBe('EAS_BUILD_UNSUPPORTED_BUNDLER_VERSION_ERROR');
    expect(err.userFacingErrorCode).toBe('EAS_BUILD_UNSUPPORTED_BUNDLER_VERSION_ERROR');
  });

  it('does not detect errors if they show up in different build phase', async () => {
    const fakeError = new Error();
    const err = await resolveBuildPhaseErrorAsync(
      fakeError,
      [
        "/System/Library/Frameworks/Ruby.framework/Versions/2.6/usr/lib/ruby/2.6.0/rubygems/dependency.rb:313:in `to_specs': Could not find 'bundler' (2.2.3) required by your /Users/expo/project/build/ios/Gemfile.lock. (Gem::MissingSpecVersionError)",
      ],
      {
        job: { platform: Platform.IOS } as Job,
        phase: BuildPhase.INSTALL_DEPENDENCIES, // it should be in RUN_FASTLANE
        env: {},
      },
      '/fake/path'
    );
    expect(err.errorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
    expect(err.userFacingErrorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
  });

  it('detects npm cache error if cache is enabled', async () => {
    const mockEnv = {
      EAS_BUILD_NPM_CACHE_URL: 'https://dominik.sokal.pl/npm/cache',
    };

    const fakeError = new Error();
    const err = await resolveBuildPhaseErrorAsync(
      fakeError,
      [`Blah blah Error ... ${mockEnv.EAS_BUILD_NPM_CACHE_URL}`],
      {
        job: { platform: Platform.ANDROID } as Job,
        phase: BuildPhase.INSTALL_DEPENDENCIES,
        env: mockEnv,
      },
      '/fake/path'
    );
    expect(err.errorCode).toBe('NPM_CACHE_ERROR');
    expect(err.userFacingErrorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
  });

  it('does not detect npm cache error if cache is disabled', async () => {
    const mockEnv = {
      EAS_BUILD_NPM_CACHE_URL: 'https://dominik.sokal.pl/npm/cache',
    };

    const fakeError = new Error();
    const err = await resolveBuildPhaseErrorAsync(
      fakeError,
      [`Blah blah Error ... ${mockEnv.EAS_BUILD_NPM_CACHE_URL}`],
      {
        job: { platform: Platform.ANDROID } as Job,
        phase: BuildPhase.INSTALL_DEPENDENCIES,
        env: {},
      },
      '/fake/path'
    );
    expect(err.errorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
    expect(err.userFacingErrorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
  });

  it('detects xcode line error', async () => {
    const fakeError = new Error();
    const err = await resolveBuildPhaseErrorAsync(
      fakeError,
      [''],
      {
        job: { platform: Platform.IOS } as Job,
        phase: BuildPhase.RUN_FASTLANE,
        env: {},
      },
      path.resolve('./src/buildErrors/__tests__/fixtures')
    );
    expect(err.errorCode).toBe('XCODE_RESOURCE_BUNDLE_CODE_SIGNING_ERROR');
    expect(err.userFacingErrorCode).toBe('XCODE_RESOURCE_BUNDLE_CODE_SIGNING_ERROR');
  });

  it('detects minimum deployment target error correctly', async () => {
    const fakeError = new Error();
    const err = await resolveBuildPhaseErrorAsync(
      fakeError,
      [
        'CocoaPods could not find compatible versions for pod "react-native-google-maps":16  In Podfile:17    react-native-google-maps (from `/Users/expo/workingdir/build/node_modules/react-native-maps`)18Specs satisfying the `react-native-google-maps (from `/Users/expo/workingdir/build/node_modules/react-native-maps`)` dependency were found, but they required a higher minimum deployment target.19Error: Compatible versions of some pods could not be resolved.',
      ],
      {
        job: { platform: Platform.IOS } as Job,
        phase: BuildPhase.INSTALL_PODS,
        env: {},
      },
      '/fake/path'
    );
    expect(err.errorCode).toBe('EAS_BUILD_HIGHER_MINIMUM_DEPLOYMENT_TARGET_ERROR');
    expect(err.userFacingErrorCode).toBe('EAS_BUILD_HIGHER_MINIMUM_DEPLOYMENT_TARGET_ERROR');
  });

  it('detects resign error in "Run Fastlane" phase correctly', async () => {
    const fakeError = new Error();
    const err = await resolveBuildPhaseErrorAsync(
      fakeError,
      [
        `No provisioning profile for application: '_floatsignTemp/Payload/EcoBatteryPREVIEW.app' with bundle identifier 'com.ecobattery.ecobattery-preview'`,
      ],
      {
        job: { platform: Platform.IOS, mode: BuildMode.RESIGN } as Job,
        phase: BuildPhase.RUN_FASTLANE,
        env: {},
      },
      '/fake/path'
    );
    expect(err.errorCode).toBe('EAS_BUILD_UNKNOWN_FASTLANE_RESIGN_ERROR');
    expect(err.userFacingErrorCode).toBe('EAS_BUILD_UNKNOWN_FASTLANE_RESIGN_ERROR');
  });

  it('detects build error in "Run Fastlane" phase correctly', async () => {
    const fakeError = new Error();
    const err = await resolveBuildPhaseErrorAsync(
      fakeError,
      [`some build error`],
      {
        job: { platform: Platform.IOS, mode: BuildMode.BUILD } as Job,
        phase: BuildPhase.RUN_FASTLANE,
        env: {},
      },
      '/fake/path'
    );
    expect(err.errorCode).toBe('EAS_BUILD_UNKNOWN_FASTLANE_ERROR');
    expect(err.userFacingErrorCode).toBe('EAS_BUILD_UNKNOWN_FASTLANE_ERROR');
  });
});
