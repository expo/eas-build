import { BuildPhase, Platform } from '@expo/eas-build-job';
import escapeRegExp from 'lodash/escapeRegExp';

import { ErrorContext, ErrorHandler } from './errors.types';

export class TrackedBuildError extends Error {
  constructor(public errorCode: string, public message: string) {
    super(message);
  }
}

export const buildErrorHandlers: ErrorHandler<TrackedBuildError>[] = [
  {
    platform: Platform.IOS,
    phase: BuildPhase.INSTALL_PODS,
    // example log:
    // CDN: trunk URL couldn't be downloaded: https://cdn.jsdelivr.net/cocoa/Specs/2/a/e/MultiplatformBleAdapter/0.0.3/MultiplatformBleAdapter.podspec.json Response: 429 429: Too Many Requests
    regexp: /CDN: trunk URL couldn't be downloaded.* Response: 429 429: Too Many Requests/,
    createError: () =>
      new TrackedBuildError('COCOAPODS_TO_MANY_REQUEST', 'cocoapods: too many requests'),
  },
  {
    phase: BuildPhase.PREBUILD,
    regexp: /Input is required, but Expo CLI is in non-interactive mode/,
    createError: () =>
      new TrackedBuildError(
        'EXPO_CLI_INPUT_REQUIRED_ERROR',
        `expo-cli: input required in non-interactive mode`
      ),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.PREBUILD,
    // [03:03:05] [ios.infoPlist]: withIosInfoPlistBaseMod: GoogleService-Info.plist is empty
    regexp: /withIosInfoPlistBaseMod: GoogleService-Info\.plist is empty/,
    createError: () =>
      new TrackedBuildError(
        'EXPO_CLI_EMPTY_GOOGLE_SERVICES_PLIST_ERROR',
        `expo-cli: empty GoogleService-Info.plist`
      ),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.PREBUILD,
    // [01:52:04] [ios.xcodeproj]: withIosXcodeprojBaseMod: Path to GoogleService-Info.plist is not defined. Please specify the `expo.ios.googleServicesFile` field in app.json.
    regexp: /withIosXcodeprojBaseMod: Path to GoogleService-Info\.plist is not defined/,
    createError: () =>
      new TrackedBuildError(
        'EXPO_CLI_NOT_DEFINED_GOOGLE_SERVICES_PLIST_ERROR',
        `expo-cli: path to GoogleService-Info.plist not defined`
      ),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.INSTALL_PODS,
    // Adding spec repo `24-repository-cocoapods-proxy` with CDN `http://10.254.24.7:8081/repository/cocoapods-proxy/`
    // [!] No podspec exists at path `/Users/expo/.cocoapods/repos/24-repository-cocoapods-proxy/Specs/1/9/2/libwebp/1.2.0/libwebp.podspec.json`.
    regexp: /Adding spec repo .* with CDN .*\n\s*\[!\] No podspec exists at path `(.*)`/,
    // Some pods are hosted on git registries that are not supported e.g. chromium.googlesource.com
    createError: (match: RegExpMatchArray) =>
      new TrackedBuildError(
        'COCOAPODS_CACHE_INCOMPATIBLE_REPO_ERROR',
        `cocoapods: missing podspec ${match[1]}`
      ),
  },
  ...[BuildPhase.INSTALL_DEPENDENCIES, BuildPhase.PREBUILD].map((phase) => ({
    phase,
    // example log:
    // [stderr] WARN tarball tarball data for @typescript-eslint/typescript-estree@5.26.0 (sha512-cozo/GbwixVR0sgfHItz3t1yXu521yn71Wj6PlYCFA3WPhy51CUPkifFKfBis91bDclGmAY45hhaAXVjdn4new==) seems to be corrupted. Trying again.
    regexp: /tarball tarball data for ([^ ]*) .* seems to be corrupted. Trying again/,
    createError: (match: RegExpMatchArray) =>
      new TrackedBuildError('NPM_CORRUPTED_PACKAGE', `npm: corrupted package ${match[1]}`),
  })),
  ...[BuildPhase.INSTALL_DEPENDENCIES, BuildPhase.PREBUILD].map((phase) => ({
    phase,
    regexp: ({ env }: ErrorContext) =>
      env.EAS_BUILD_NPM_CACHE_URL
        ? new RegExp(escapeRegExp(env.EAS_BUILD_NPM_CACHE_URL))
        : undefined,
    createError: () => new TrackedBuildError('NPM_CACHE_ERROR', `npm: cache error`),
  })),
  {
    platform: Platform.ANDROID,
    phase: BuildPhase.RUN_GRADLEW,
    regexp: ({ env }: ErrorContext) =>
      env.EAS_BUILD_MAVEN_CACHE_URL
        ? new RegExp(escapeRegExp(env.EAS_BUILD_MAVEN_CACHE_URL))
        : undefined,
    createError: () => new TrackedBuildError('MAVEN_CACHE_ERROR', `maven: cache error`),
  },
  {
    platform: Platform.IOS,
    phase: BuildPhase.INSTALL_PODS,
    regexp: ({ env }: ErrorContext) =>
      env.EAS_BUILD_COCOAPODS_CACHE_URL
        ? new RegExp(escapeRegExp(env.EAS_BUILD_COCOAPODS_CACHE_URL))
        : undefined,
    createError: () => new TrackedBuildError('COCOAPODS_CACHE_ERROR', `cocoapods: cache error`),
  },
];
