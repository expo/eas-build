export enum BuildPhase {
  UNKNOWN = 'UNKNOWN',
  QUEUE = 'QUEUE',
  SPIN_UP_BUILDER = 'SPIN_UP_BUILDER',
  BUILDER_INFO = 'BUILDER_INFO',
  READ_APP_CONFIG = 'READ_APP_CONFIG',
  READ_PACKAGE_JSON = 'READ_PACKAGE_JSON',
  RUN_EXPO_DOCTOR = 'RUN_EXPO_DOCTOR',
  SET_UP_BUILD_ENVIRONMENT = 'SET_UP_BUILD_ENVIRONMENT',
  START_BUILD = 'START_BUILD',
  INSTALL_CUSTOM_TOOLS = 'INSTALL_CUSTOM_TOOLS',
  PREPARE_PROJECT = 'PREPARE_PROJECT',
  RESTORE_CACHE = 'RESTORE_CACHE',
  INSTALL_DEPENDENCIES = 'INSTALL_DEPENDENCIES',
  PREBUILD = 'PREBUILD',
  PREPARE_CREDENTIALS = 'PREPARE_CREDENTIALS',
  CONFIGURE_EXPO_UPDATES = 'CONFIGURE_EXPO_UPDATES',
  SAVE_CACHE = 'SAVE_CACHE',
  UPLOAD_ARTIFACTS = 'UPLOAD_ARTIFACTS',
  UPLOAD_APPLICATION_ARCHIVE = 'UPLOAD_APPLICATION_ARCHIVE',
  UPLOAD_BUILD_ARTIFACTS = 'UPLOAD_BUILD_ARTIFACTS',
  PREPARE_ARTIFACTS = 'PREPARE_ARTIFACTS',
  CLEAN_UP_CREDENTIALS = 'CLEAN_UP_CREDENTIALS',
  COMPLETE_BUILD = 'COMPLETE_BUILD',
  FAIL_BUILD = 'FAIL_BUILD',

  // ANDROID
  FIX_GRADLEW = 'FIX_GRADLEW',
  RUN_GRADLEW = 'RUN_GRADLEW',

  // IOS
  INSTALL_PODS = 'INSTALL_PODS',
  CONFIGURE_XCODE_PROJECT = 'CONFIGURE_XCODE_PROJECT',
  RUN_FASTLANE = 'RUN_FASTLANE',

  // HOOKS
  PRE_INSTALL_HOOK = 'PRE_INSTALL_HOOK',
  POST_INSTALL_HOOK = 'POST_INSTALL_HOOK',
  PRE_UPLOAD_ARTIFACTS_HOOK = 'PRE_UPLOAD_ARTIFACTS_HOOK',
  ON_BUILD_SUCCESS_HOOK = 'ON_BUILD_SUCCESS_HOOK',
  ON_BUILD_ERROR_HOOK = 'ON_BUILD_ERROR_HOOK',
  ON_BUILD_COMPLETE_HOOK = 'ON_BUILD_COMPLETE_HOOK',
}

export enum BuildPhaseResult {
  SUCCESS = 'success',
  FAIL = 'failed',
  WARNING = 'warning',
  SKIPPED = 'skipped',
  UNKNOWN = 'unknown',
}

export enum LogMarker {
  START_PHASE = 'START_PHASE',
  END_PHASE = 'END_PHASE',
}
