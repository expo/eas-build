import { BuildPhase, errors, Job, Platform } from '@expo/eas-build-job';

import { resolveBuildPhaseError } from '../detectError';

describe(resolveBuildPhaseError, () => {
  it('detects log for corrupted npm package', () => {
    const fakeError = new Error();
    const err = resolveBuildPhaseError(
      fakeError,
      [
        '[stderr] WARN tarball tarball data for @typescript-eslint/typescript-estree@5.26.0 (sha512-cozo/GbwixVR0sgfHItz3t1yXu521yn71Wj6PlYCFA3WPhy51CUPkifFKfBis91bDclGmAY45hhaAXVjdn4new==) seems to be corrupted. Trying again.',
      ],
      {
        job: {} as Job,
        phase: BuildPhase.INSTALL_DEPENDENCIES,
        env: {},
      }
    );
    expect(err.errorCode).toBe('NPM_CORRUPTED_PACKAGE');
    expect(err.userFacingErrorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
  });

  it('detects log for invalid bundler and reports it to user', () => {
    const fakeError = new Error();
    const err = resolveBuildPhaseError(
      fakeError,
      [
        "/System/Library/Frameworks/Ruby.framework/Versions/2.6/usr/lib/ruby/2.6.0/rubygems/dependency.rb:313:in `to_specs': Could not find 'bundler' (2.2.3) required by your /Users/expo/project/build/ios/Gemfile.lock. (Gem::MissingSpecVersionError)",
      ],
      {
        job: { platform: Platform.IOS } as Job,
        phase: BuildPhase.RUN_FASTLANE,
        env: {},
      }
    );
    expect(err.errorCode).toBe('EAS_BUILD_UNSUPPORTED_BUNDLER_VERSION_ERROR');
    expect(err.userFacingErrorCode).toBe('EAS_BUILD_UNSUPPORTED_BUNDLER_VERSION_ERROR');
  });

  it('does not detect errors if they show up in different build phase', () => {
    const fakeError = new Error();
    const err = resolveBuildPhaseError(
      fakeError,
      [
        "/System/Library/Frameworks/Ruby.framework/Versions/2.6/usr/lib/ruby/2.6.0/rubygems/dependency.rb:313:in `to_specs': Could not find 'bundler' (2.2.3) required by your /Users/expo/project/build/ios/Gemfile.lock. (Gem::MissingSpecVersionError)",
      ],
      {
        job: { platform: Platform.IOS } as Job,
        phase: BuildPhase.INSTALL_DEPENDENCIES, // it should be in RUN_FASTLANE
        env: {},
      }
    );
    expect(err.errorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
    expect(err.userFacingErrorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
  });

  it('detects npm cache error if cache is enabled', () => {
    const mockEnv = {
      EAS_BUILD_NPM_CACHE_URL: 'https://dominik.sokal.pl/npm/cache',
    };

    const fakeError = new Error();
    const err = resolveBuildPhaseError(
      fakeError,
      [`Blah blah Error ... ${mockEnv.EAS_BUILD_NPM_CACHE_URL}`],
      {
        job: {} as Job,
        phase: BuildPhase.INSTALL_DEPENDENCIES,
        env: mockEnv,
      }
    );
    expect(err.errorCode).toBe('NPM_CACHE_ERROR');
    expect(err.userFacingErrorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
  });

  it('does not detect npm cache error if cache is disabled', () => {
    const mockEnv = {
      EAS_BUILD_NPM_CACHE_URL: 'https://dominik.sokal.pl/npm/cache',
    };

    const fakeError = new Error();
    const err = resolveBuildPhaseError(
      fakeError,
      [`Blah blah Error ... ${mockEnv.EAS_BUILD_NPM_CACHE_URL}`],
      {
        job: {} as Job,
        phase: BuildPhase.INSTALL_DEPENDENCIES,
        env: {},
      }
    );
    expect(err.errorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
    expect(err.userFacingErrorCode).toBe(errors.ErrorCode.UNKNOWN_ERROR);
  });
});
