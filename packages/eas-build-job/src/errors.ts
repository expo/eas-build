export enum ErrorCode {
  UKNOWN_ERROR = 'UNKNOWN_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',
  CREDENTIALS_DIST_CERT_MISMATCH = 'EAS_BUILD_CREDENTIALS_DIST_CERT_MISMATCH',
  SYSTEM_DEPS_INSTALL_ERROR = 'EAS_BUILD_SYSTEM_DEPS_INSTALL_ERROR',
  UNSUPPORTED_COCOAPODS_VERSION_ERROR = 'EAS_BUILD_UNSUPPORTED_COCOAPODS_VERSION_ERROR',
  UNSUPPORTED_BUNDLER_VERSION_ERROR = 'EAS_BUILD_UNSUPPORTED_BUNDLER_VERSION_ERROR',
  INVALID_KEYSTORE_FORMAT_ERROR = 'EAS_BUILD_INVALID_KEYSTORE_FORMAT_ERROR',
  INVALID_KEYSTORE_ALIAS_ERROR = 'EAS_BUILD_INVALID_KEYSTORE_ALIAS_ERROR',
  MISSING_GOOGLE_SERVICES_JSON_ERROR = 'EAS_BUILD_MISSING_GOOGLE_SERVICES_JSON_ERROR',
  MISSING_GOOGLE_SERVICES_PLIST_ERROR = 'EAS_BUILD_MISSING_GOOGLE_SERVICES_PLIST_ERROR',
  INCOMPATIBLE_PODS_MANAGED_WORKFLOW_ERROR = 'EAS_BUILD_INCOMPATIBLE_PODS_MANAGED_WORKFLOW_ERROR',
  INCOMPATIBLE_PODS_GENERIC_WORKFLOW_ERROR = 'EAS_BUILD_INCOMPATIBLE_PODS_GENERIC_WORKFLOW_ERROR',
  YARN_LOCK_CHECKSUM_ERROR = 'EAS_BUILD_YARN_LOCK_CHECKSUM_ERROR',
  UNKNOWN_FASTLANE_ERROR = 'EAS_BUILD_UNKNOWN_FASTLANE_ERROR',
  UNKNOWN_GRADLE_ERROR = 'EAS_BUILD_UNKNOWN_GRADLE_ERROR',
  BUILD_TIMEOUT_ERROR = 'EAS_BUILD_TIMEOUT_ERROR',
}

export interface ExternalUserError {
  errorCode: string;
  message: string;
  docsUrl?: string;
}

export abstract class UserError extends Error {
  public abstract errorCode: ErrorCode;
  public docsUrl?: string;
  public innerError?: Error;

  public format(): ExternalUserError {
    return {
      errorCode: this.errorCode,
      message: this.message,
      docsUrl: this.docsUrl,
    };
  }
}

export class UnknownError extends UserError {
  errorCode = ErrorCode.UKNOWN_ERROR;
  message = 'Unknown error. Please see logs.';
}

export class ServerError extends UserError {
  errorCode = ErrorCode.SERVER_ERROR;
  message =
    'Internal Server Error.\nPlease try again later. If the problem persists, please report the issue.';
}

export class BuildTimeout extends ServerError {
  constructor(maxBuildTimeMs: number) {
    super();
    this.message = `Your build has exceeded the maximum build time of ${
      maxBuildTimeMs / (60 * 1000)
    } minutes.`;
  }
}

export class CredentialsDistCertMismatchError extends UserError {
  errorCode = ErrorCode.CREDENTIALS_DIST_CERT_MISMATCH;
  message = "Provisioning profile and distribution certificate don't match.";
}

export class SystemDepsInstallError extends UserError {
  errorCode = ErrorCode.SYSTEM_DEPS_INSTALL_ERROR;

  constructor(dependency: string) {
    super();
    this.message = `Failed to install ${dependency}. Make sure you specified the correct version in eas.json.`;
  }
}

export class InvalidKeystoreFormatError extends UserError {
  errorCode = ErrorCode.INVALID_KEYSTORE_FORMAT_ERROR;
  message =
    'The keystore used in this build is malformed or it has an unsupported type. Make sure you provided the correct file.';
}

export class InvalidKeystoreAliasError extends UserError {
  errorCode = ErrorCode.INVALID_KEYSTORE_FORMAT_ERROR;
  message =
    'The alias specified for this keystore does not exist. Make sure you specified the correct value.';
}

export class UnsupportedCocoaPodsVersion extends UserError {
  errorCode = ErrorCode.UNSUPPORTED_COCOAPODS_VERSION_ERROR;
  message = `Your project requires a newer version of CocoaPods, you can update it in the build profile in eas.json by either:
- changing the current version under key "cocoapods"
- switching to an image that supports that version under key "image"`;
  docsUrl = 'https://docs.expo.io/build/eas-json';
}

export class UnsupportedBundlerVersion extends UserError {
  errorCode = ErrorCode.UNSUPPORTED_BUNDLER_VERSION_ERROR;
  message = `Your project requires another version of bundler, you can change it in the build profile in eas.json by specifying the version under key "bundler"`;
  docsUrl = 'https://docs.expo.io/build/eas-json';
}

export class MissingGoogleServicesJson extends UserError {
  errorCode = ErrorCode.MISSING_GOOGLE_SERVICES_JSON_ERROR;
  message =
    '"google-services.json" is missing, make sure that file exists. Remember that EAS Build only uploads the files tracked by git.';
}

export class MissingGoogleServicesPlist extends UserError {
  errorCode = ErrorCode.MISSING_GOOGLE_SERVICES_PLIST_ERROR;
  message =
    '"GoogleService-Info.plist" is missing, make sure that file exists. Remember that EAS Build only uploads the files tracked by git.';
}

export class UnknownFastlaneError extends UserError {
  errorCode = ErrorCode.UNKNOWN_FASTLANE_ERROR;
  message = `Fastlane build failed with unknown error. Please refer to the "Run fastlane" and "Xcode Logs" phases.
Fastlane errors in most cases are not printed at the end of the output, so you may not find any useful information in the last lines of output when looking for an error message.`;
}

export class IncompatiblePodsManagedWorkflowError extends UserError {
  errorCode = ErrorCode.INCOMPATIBLE_PODS_MANAGED_WORKFLOW_ERROR;

  constructor(usingDefaultCacheConfig: boolean) {
    super();
    this.message = `Compatible versions of some pods could not be resolved.
You are seeing this error because either:
  - Versions in the Podfile.lock cached by EAS do not match required values for some of the libraries, it can be triggered when upgrading Expo SDK or any other library with native code. To fix that ${
    usingDefaultCacheConfig
      ? 'add the "cache.key" field (it can be set to any value) in eas.json to invalidate the cache.'
      : 'update value of the "cache.key" field in eas.json to invalidate the cache.'
  }
  - Some of your npm packages have native code that depend on different versions of the same pod. Please see logs for more info.
`;
  }
}

export class IncompatiblePodsGenericWorkflowError extends UserError {
  errorCode = ErrorCode.INCOMPATIBLE_PODS_GENERIC_WORKFLOW_ERROR;

  constructor(usingDefaultCacheConfig: boolean) {
    super();
    this.message = `Compatible versions of some pods could not be resolved.
You are seeing this error because either:
  - Versions in the Podfile.lock cached by EAS do not match required values in Podspecs of some of the libraries. To fix that ${
    usingDefaultCacheConfig
      ? 'add the "cache.key" field (it can be set to any value) in eas.json to invalidate the cache.'
      : 'update value of the "cache.key" field in eas.json to invalidate the cache.'
  }
  - Some of the pods used in your project depend on different versions of the same pod. Please see logs for more info.
`;
  }
}

export class YarnLockChecksumError extends UserError {
  errorCode = ErrorCode.YARN_LOCK_CHECKSUM_ERROR;

  constructor(packageName: string) {
    super();
    this.message = `Checksum for package "${packageName}" does not match value in registry. To fix that:
- run "yarn cache clean"
- remove yarn.lock (or only the section for that package)
- run "yarn install --force"`;
  }
}

export class UnknownGradleError extends UserError {
  errorCode = ErrorCode.UNKNOWN_GRADLE_ERROR;
  message = 'Gradle build failed with unknown error. Please see logs for the "Run gradlew" phase.';
}
