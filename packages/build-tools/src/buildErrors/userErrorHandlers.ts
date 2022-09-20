import { BuildPhase, errors, Platform, Workflow } from '@expo/eas-build-job';

import { ErrorHandler, XCODE_BUILD_PHASE } from './errors.types';

import UserFacingError = errors.UserFacingError;

export const userErrorHandlers: ErrorHandler<UserFacingError>[] = [
  {
    platform: Platform.IOS,
    phase: BuildPhase.INSTALL_PODS,
    regexp: /requires CocoaPods version/,
    // example log:
    // [!] `React` requires CocoaPods version `>= 1.10.1`, which is not satisfied by your current version, `1.10.0`.
    createError: () =>
      new UserFacingError(
        'EAS_BUILD_UNSUPPORTED_COCOAPODS_VERSION_ERROR',
        `Your project requires a newer version of CocoaPods. You can update it in the build profile in eas.json by either:
- changing the current version under key "cocoapods"
- switching to an image that supports that version under key "image"`,
        'https://docs.expo.dev/build-reference/eas-json/'
      ),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.RUN_FASTLANE,
    regexp: /Could not find 'bundler' (.*) required by your/,
    // example log:
    // /System/Library/Frameworks/Ruby.framework/Versions/2.6/usr/lib/ruby/2.6.0/rubygems/dependency.rb:313:in `to_specs': Could not find 'bundler' (2.2.3) required by your /Users/expo/project/build/ios/Gemfile.lock. (Gem::MissingSpecVersionError)
    createError: () =>
      new UserFacingError(
        'EAS_BUILD_UNSUPPORTED_BUNDLER_VERSION_ERROR',
        `Your project requires a different version of the Ruby "bundler" program than the version installed in this EAS Build environment. You can specify which version of "bundler" to install by specifying the version under "build"→[buildProfileName]→"ios"→"bundler" in eas.json.`,
        'https://docs.expo.dev/build-reference/eas-json/'
      ),
  },
  {
    platform: Platform.ANDROID,
    phase: BuildPhase.RUN_GRADLEW,
    // example log:
    // > Failed to read key keyalias from store "/build/workingdir/build/generic/keystore-5787e6af-3002-4cb7-8a57-3e73d13313c2.jks": Invalid keystore format
    regexp: /Invalid keystore format/,
    createError: () =>
      new UserFacingError(
        'EAS_BUILD_INVALID_KEYSTORE_FORMAT_ERROR',
        'The keystore used in this build is malformed or it has an unsupported type. Make sure you provided the correct file.'
      ),
  },
  {
    platform: Platform.ANDROID,
    phase: BuildPhase.RUN_GRADLEW,
    // example log:
    // > Failed to read key keyalias from store "/build/workingdir/build/generic/keystore-286069a8-4bb9-48a6-add9-acf6b58ea06d.jks": null
    regexp: /Failed to read key[^\n]+from store/,
    createError: () =>
      new UserFacingError(
        'EAS_BUILD_INVALID_KEYSTORE_ALIAS_ERROR',
        'The alias specified for this keystore does not exist. Make sure you specified the correct value.'
      ),
  },
  {
    platform: Platform.ANDROID,
    phase: BuildPhase.PREBUILD,
    // example log:
    // [15:42:05] Error: Cannot copy google-services.json from /build/workingdir/build/managed/abc to /build/workingdir/build/managed/android/app/google-services.json
    // or
    // [11:17:29] [android.dangerous]: withAndroidDangerousBaseMod: Cannot copy google-services.json from /home/expo/workingdir/build/test/test-google-services.json to /home/expo/workingdir/build/android/app/google-services.json. Please make sure the source and destination paths exist.
    // [11:17:29] Error: [android.dangerous]: withAndroidDangerousBaseMod: Cannot copy google-services.json from /home/expo/workingdir/build/test/test-google-services.json to /home/expo/workingdir/build/android/app/google-services.json. Please make sure the source and destination paths exist.
    regexp: /Cannot copy google-services\.json/,
    createError: () =>
      new UserFacingError(
        'EAS_BUILD_MISSING_GOOGLE_SERVICES_JSON_ERROR',
        '"google-services.json" is missing, make sure that file exists. Remember that EAS Build only uploads the files tracked by git.'
      ),
  },
  {
    platform: Platform.ANDROID,
    phase: BuildPhase.RUN_GRADLEW,
    // Execution failed for task ':app:processReleaseGoogleServices'.
    // > File google-services.json is missing. The Google Services Plugin cannot function without it.
    //    Searched Location:
    regexp: /File google-services\.json is missing\. The Google Services Plugin cannot function without it/,
    createError: () =>
      new UserFacingError(
        'EAS_BUILD_MISSING_GOOGLE_SERVICES_JSON_ERROR',
        '"google-services.json" is missing, make sure that file exists. Remember that EAS Build only uploads the files tracked by git.'
      ),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.PREBUILD,
    // example log:
    // [08:44:18] ENOENT: no such file or directory, copyfile '/Users/expo/workingdir/build/managed/abc' -> '/Users/expo/workingdir/build/managed/ios/testapp/GoogleService-Info.plist'
    regexp: /ENOENT: no such file or directory, copyfile .*GoogleService-Info.plist/,
    createError: () =>
      new UserFacingError(
        'EAS_BUILD_MISSING_GOOGLE_SERVICES_PLIST_ERROR',
        '"GoogleService-Info.plist" is missing, make sure that file exists. Remember that EAS Build only uploads the files tracked by git.'
      ),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.INSTALL_PODS,
    // example log:
    // [!] CocoaPods could not find compatible versions for pod "Firebase/Core":
    //   In snapshot (Podfile.lock):
    //     Firebase/Core (= 6.14.0)
    //   In Podfile:
    //     EXFirebaseCore (from `../node_modules/expo-firebase-core/ios`) was resolved to 3.0.0, which depends on
    //       Firebase/Core (= 7.7.0)
    // You have either:
    //  * out-of-date source repos which you can update with `pod repo update` or with `pod install --repo-update`.
    //  * changed the constraints of dependency `Firebase/Core` inside your development pod `EXFirebaseCore`.
    //    You should run `pod update Firebase/Core` to apply changes you've made.
    regexp: /CocoaPods could not find compatible versions for pod /,
    createError: (_, { job }) => {
      const usingDefaultCacheConfig = job.cache.key === '' || !job.cache.key;
      return job.type === Workflow.MANAGED
        ? new UserFacingError(
            'EAS_BUILD_INCOMPATIBLE_PODS_MANAGED_WORKFLOW_ERROR',
            `Compatible versions of some pods could not be resolved.
You are seeing this error because either:
  - Versions in the Podfile.lock cached by EAS do not match required values in Podspecs of some of the libraries. To fix that ${
    usingDefaultCacheConfig
      ? 'add the "cache.key" field (it can be set to any value) in the build profile in eas.json to invalidate the cache.'
      : 'update value of the "cache.key" field in the build profile in eas.json to invalidate the cache.'
  }
  - Some of the pods used in your project depend on different versions of the same pod. See logs for more information.
`
          )
        : new UserFacingError(
            'EAS_BUILD_INCOMPATIBLE_PODS_GENERIC_WORKFLOW_ERROR',
            `Compatible versions of some pods could not be resolved.
You are seeing this error because either:
  - Versions in the Podfile.lock cached by EAS do not match required values in Podspecs of some of the libraries. To fix that ${
    usingDefaultCacheConfig
      ? 'add the "cache.key" field (it can be set to any value) in the build profile in eas.json to invalidate the cache.'
      : 'update value of the "cache.key" field in the build profile in eas.json to invalidate the cache.'
  }
  - Some of the pods used in your project depend on different versions of the same pod. See logs for more information.
`
          );
    },
  },
  {
    phase: BuildPhase.INSTALL_DEPENDENCIES,
    // example log:
    // [stderr] error https://github.com/expo/react-native/archive/sdk-41.0.0.tar.gz: Integrity check failed for "react-native" (computed integrity doesn't match our records, got "sha512-3jHI2YufrJi7eIABRf/DN/I2yOkmIZ0vAyezTz+PAUJiEs4v//5LLojWEU+W53AZsnuaEMcl/4fVy4bd+OuUbA== sha1-o9QuQTXIkc8VozXPaZIullB9a40=")
    regexp: /Integrity check failed for "(.*)" \(computed integrity doesn't match our records, got/,
    createError: (matchResult: RegExpMatchArray) => {
      if (matchResult.length >= 2) {
        return new UserFacingError(
          'EAS_BUILD_YARN_LOCK_CHECKSUM_ERROR',
          `Checksum for package "${matchResult[1]}" does not match value in registry. To fix that:
- run "yarn cache clean"
- remove yarn.lock (or only the section for that package)
- run "yarn install --force"`
        );
      }
      return undefined;
    },
  },
  {
    phase: BuildPhase.INSTALL_DEPENDENCIES,
    // example log:
    // yarn install v1.22.17
    // [1/4] Resolving packages...
    // [2/4] Fetching packages...
    // [1/4] Resolving packages...
    // [2/4] Fetching packages...
    // [stderr] error https://registry.yarnpkg.com/jest-util/-/jest-util-26.6.2.tgz: Extracting tar content of undefined failed, the file appears to be corrupt: "ENOENT: no such file or directory, chmod '/Users/expo/Library/Caches/Yarn/v6/npm-jest-util-26.6.2-907535dbe4d5a6cb4c47ac9b926f6af29576cbc1-integrity/node_modules/jest-util/build/pluralize.d.ts'"
    regexp: /\[1\/4\] Resolving packages...\s*\[2\/4\] Fetching packages...\s*\[1\/4\] Resolving packages...\s*\[2\/4\] Fetching packages.../,
    createError: (matchResult: RegExpMatchArray) => {
      if (matchResult) {
        return new UserFacingError(
          'EAS_BUILD_YARN_MULTIPLE_INSTANCES_ERROR',
          `One of project dependencies is starting new install process while the main one is still in progress, which might result in corrupted packages. Most likely the reason for error is "prepare" script in git-referenced dependency of your project. Learn more: https://github.com/yarnpkg/yarn/issues/7212#issuecomment-493720324`
        );
      }
      return undefined;
    },
  },
  {
    platform: Platform.IOS,
    phase: XCODE_BUILD_PHASE,
    // Prepare packages
    // Computing target dependency graph and provisioning inputs
    // Create build description
    // Build description signature: 33a5c28977280822abe5e7bd7fe02529
    // Build description path: /Users/expo/Library/Developer/Xcode/DerivedData/testapp-fazozgerxcvvfifkipojsjftgyih/Build/Intermediates.noindex/ArchiveIntermediates/testapp/IntermediateBuildFilesPath/XCBuildData/33a5c28977280822abe5e7bd7fe02529-desc.xcbuild
    // note: Building targets in dependency order
    // /Users/expo/workingdir/build/managed/ios/Pods/Pods.xcodeproj: error: Signing for "EXConstants-EXConstants" requires a development team. Select a development team in the Signing & Capabilities editor. (in target 'EXConstants-EXConstants' from project 'Pods')
    // /Users/expo/workingdir/build/managed/ios/Pods/Pods.xcodeproj: error: Signing for "React-Core-AccessibilityResources" requires a development team. Select a development team in the Signing & Capabilities editor. (in target 'React-Core-AccessibilityResources' from project 'Pods')
    // warning: Run script build phase '[CP-User] Generate app.manifest for expo-updates' will be run during every build because it does not specify any outputs. To address this warning, either add output dependencies to the script phase, or configure it to run in every build by unchecking "Based on dependency analysis" in the script phase. (in target 'EXUpdates' from project 'Pods')
    // warning: Run script build phase 'Start Packager' will be run during every build because it does not specify any outputs. To address this warning, either add output dependencies to the script phase, or configure it to run in every build by unchecking "Based on dependency analysis" in the script phase. (in target 'testapp' from project 'testapp')
    // warning: Run script build phase 'Bundle React Native code and images' will be run during every build because it does not specify any outputs. To address this warning, either add output dependencies to the script phase, or configure it to run in every build by unchecking "Based on dependency analysis" in the script phase. (in target 'testapp' from project 'testapp')
    // warning: Run script build phase '[CP-User] Generate app.config for prebuilt Constants.manifest' will be run during every build because it does not specify any outputs. To address this warning, either add output dependencies to the script phase, or configure it to run in every build by unchecking "Based on dependency analysis" in the script phase. (in target 'EXConstants' from project 'Pods')
    // /Users/expo/workingdir/build/managed/ios/Pods/Pods.xcodeproj: error: Signing for "EXUpdates-EXUpdates" requires a development team. Select a development team in the Signing & Capabilities editor. (in target 'EXUpdates-EXUpdates' from project 'Pods')
    regexp: /error: Signing for "[a-zA-Z-0-9_]+" requires a development team/,
    createError: (_, { job }) =>
      job.type === Workflow.MANAGED
        ? new UserFacingError(
            'XCODE_CODE_SIGNING_ERROR',
            `Starting from Xcode 14, resource bundles are signed by default, which requires setting the development team for each resource bundle target.
To resolve this issue downgrade to the older Xcode version using an "image" field in eas.json, or upgrade to SDK 46 or higher.`,
            'https://docs.expo.dev/build-reference/infrastructure/#ios-build-server-configurations'
          )
        : new UserFacingError(
            'XCODE_CODE_SIGNING_ERROR',
            `Starting from Xcode 14, resource bundles are signed by default, which requires setting the development team for each resource bundle target.
To resolve this issue downgrade to the older Xcode version using an "image" field in eas.json, or turn off signing resource bundles in your Podfile, as in this example https://github.com/expo/expo/pull/19095.`,
            'https://docs.expo.dev/build-reference/infrastructure/#ios-build-server-configurations'
          ),
  },
  {
    platform: Platform.ANDROID,
    phase: BuildPhase.RUN_GRADLEW,
    regexp: /.*/,
    createError: () =>
      new UserFacingError(
        errors.ErrorCode.UNKNOWN_GRADLE_ERROR,
        'Gradle build failed with unknown error. See logs for the "Run gradlew" phase for more information.'
      ),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.RUN_FASTLANE,
    regexp: /.*/,
    createError: () =>
      new UserFacingError(
        errors.ErrorCode.UNKNOWN_FASTLANE_ERROR,
        `Fastlane build failed with unknown error. See logs for the "Run fastlane" and "Xcode Logs" phases for more information.
Fastlane errors in most cases are not printed at the end of the output, so you may not find any useful information in the last lines of output when looking for an error message.`
      ),
  },
];
