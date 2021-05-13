import Joi from '@hapi/joi';

import { Workflow } from './common';

export type Metadata = {
  /**
   * Tracking context
   * It's used to track build process across different Expo services and tools.
   */
  trackingContext: Record<string, string | number>;

  /**
   * Application version:
   * - managed projects: expo.version in app.json/app.config.js
   * - generic projects:
   *   * iOS: CFBundleShortVersionString in Info.plist
   *   * Android: versionName in build.gradle
   */
  appVersion?: string;

  /**
   * Application build version:
   * - Android: version code
   * - iOS: build number
   */
  appBuildVersion?: string;

  /**
   * EAS CLI version
   */
  cliVersion?: string;

  /**
   * Build workflow
   * It's either 'generic' or 'managed'
   */
  workflow?: Workflow;

  /**
   * Credentials source
   * Credentials could be obtained either from credential.json or EAS servers.
   */
  credentialsSource?: 'local' | 'remote';

  /**
   * Expo SDK version
   * It's determined by the expo package version in package.json.
   * It's undefined if the expo package is not installed for the project.
   */
  sdkVersion?: string;

  /**
   * Release channel (for classic expo-updates)
   * It's undefined if the classic expo-updates package is not installed for the project.
   */
  releaseChannel?: string;

  /**
   * Configuration for Expo Updates
   */
  updates?: {
    /**
     * Channel (for Expo Updates when it is configured for for use with EAS)
     * It's undefined if the expo-updates package is not configured for use with EAS.
     */
    channel?: string;
  };

  /**
   * Distribution type
   * Indicates whether this is a build for store, internal distribution, or simulator (iOS).
   */
  distribution?: 'store' | 'internal' | 'simulator';

  /**
   * App name (expo.name in app.json/app.config.js)
   */
  appName?: string;

  /**
   * App identifier:
   * - iOS builds: the bundle identifier (expo.ios.bundleIdentifier in app.json/app.config.js)
   * - Android builds: the application id (expo.android.package in app.json/app.config.js)
   */
  appIdentifier?: string;

  /**
   * Build profile name (e.g. release)
   */
  buildProfile?: string;

  /**
   * Git commit hash (e.g. aab03fbdabb6e536ea78b28df91575ad488f5f21)
   */
  gitCommitHash?: string;

  /**
   * Username of the initiating user
   */
  username?: string;
};

export const MetadataSchema = Joi.object({
  trackingContext: Joi.object().pattern(Joi.string(), [Joi.string(), Joi.number()]).required(),
  appVersion: Joi.string(),
  appBuildVersion: Joi.string(),
  cliVersion: Joi.string(),
  workflow: Joi.string().valid('generic', 'managed'),
  distribution: Joi.string().valid('store', 'internal', 'simulator'),
  credentialsSource: Joi.string().valid('local', 'remote'),
  sdkVersion: Joi.string(),
  releaseChannel: Joi.string(),
  updates: Joi.object({
    channel: Joi.string(),
  }),
  appName: Joi.string(),
  appIdentifier: Joi.string(),
  buildProfile: Joi.string(),
  gitCommitHash: Joi.string().length(40).hex(),
  username: Joi.string(),
}).oxor('releaseChannel', 'updates.channel');
