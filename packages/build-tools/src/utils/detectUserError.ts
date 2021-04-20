import { errors, Platform, BuildPhase } from '@expo/eas-build-job';

interface ErrorHandler {
  regexp: RegExp;
  platform?: Platform;
  phase?: BuildPhase;
  createError: (matchResult: RegExpMatchArray) => errors.UserError | undefined;
}

const errorHandlers: ErrorHandler[] = [
  {
    platform: Platform.IOS,
    phase: BuildPhase.INSTALL_PODS,
    regexp: /requires CocoaPods version/,
    // example log:
    // [!] `React` requires CocoaPods version `>= 1.10.1`, which is not satisfied by your current version, `1.10.0`.
    createError: () => new errors.UnsupportedCocoaPodsVersion(),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.RUN_FASTLANE,
    regexp: /Could not find 'bundler' (.*) required by your/,
    // example log:
    // /System/Library/Frameworks/Ruby.framework/Versions/2.6/usr/lib/ruby/2.6.0/rubygems/dependency.rb:313:in `to_specs': Could not find 'bundler' (2.2.3) required by your /Users/expo/project/build/ios/Gemfile.lock. (Gem::MissingSpecVersionError)
    createError: () => new errors.UnsupportedBundlerVersion(),
  },
  {
    platform: Platform.ANDROID,
    phase: BuildPhase.RUN_GRADLEW,
    // example log:
    // > Failed to read key keyalias from store "/build/workingdir/build/generic/keystore-5787e6af-3002-4cb7-8a57-3e73d13313c2.jks": Invalid keystore format
    regexp: /Invalid keystore format/,
    createError: () => new errors.InvalidKeystoreFormatError(),
  },
  {
    platform: Platform.ANDROID,
    phase: BuildPhase.RUN_GRADLEW,
    // example log:
    // > Failed to read key keyalias from store "/build/workingdir/build/generic/keystore-286069a8-4bb9-48a6-add9-acf6b58ea06d.jks": null
    regexp: /Failed to read key[^\n]+from store/,
    createError: () => new errors.InvalidKeystoreAliasError(),
  },
  {
    platform: Platform.ANDROID,
    phase: BuildPhase.PREBUILD,
    // example log:
    // [15:42:05] Error: Cannot copy google-services.json from /build/workingdir/build/managed/abc to /build/workingdir/build/managed/android/app/google-services.json
    regexp: /Error: Cannot copy google-services\.json/,
    createError: () => new errors.MissingGoogleServicesJson(),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.PREBUILD,
    // example log:
    // [08:44:18] ENOENT: no such file or directory, copyfile '/Users/expo/workingdir/build/managed/abc' -> '/Users/expo/workingdir/build/managed/ios/testapp/GoogleService-Info.plist'
    regexp: /ENOENT: no such file or directory, copyfile .*GoogleService-Info.plist/,
    createError: () => new errors.MissingGoogleServicesPlist(),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.INSTALL_PODS,
    // example log:
    // CDN: trunk URL couldn't be downloaded: https://cdn.jsdelivr.net/cocoa/Specs/2/a/e/MultiplatformBleAdapter/0.0.3/MultiplatformBleAdapter.podspec.json Response: 429 429: Too Many Requests
    regexp: /CDN: trunk URL couldn't be downloaded.* Response: 429 429: Too Many Requests/,
    createError: () => {
      // do not report it to user, just send to sentry
      const error = new errors.UnknownError();
      error.innerError = Error('cocoapods: Too Many Requests');
      return error;
    },
  },
  {
    platform: Platform.ANDROID,
    phase: BuildPhase.RUN_GRADLEW,
    regexp: /.*/,
    createError: () => new errors.UnknownGradleError(),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.RUN_FASTLANE,
    regexp: /.*/,
    createError: () => new errors.UnknownFastlaneError(),
  },
];

export function detectUserError(
  logLines: string[],
  platform: Platform,
  phase: BuildPhase
): errors.UserError | undefined {
  const logs = logLines.join('\n');
  const handlers = errorHandlers
    .filter((handler) => handler.platform === platform || !handler.platform)
    .filter((handler) => handler.phase === phase || !handler.phase);
  for (const handler of handlers) {
    const match = logs.match(handler.regexp);
    if (match) {
      return handler.createError(match);
    }
  }
  return undefined;
}
