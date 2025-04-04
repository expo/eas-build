import { Ios, Platform } from '@expo/eas-build-job';
import {
  BuildFunctionGroup,
  BuildStep,
  BuildStepEnv,
  BuildStepGlobalContext,
  BuildStepInput,
  BuildStepInputValueTypeName,
  BuildStepOutput,
  spawnAsync,
} from '@expo/steps';
import { BuildStepInputById } from '@expo/steps/dist_esm/BuildStepInput';
import * as fs from 'fs-extra';
import isUndefined from 'lodash/isUndefined';

import { CustomBuildContext } from '../../customBuildContext';
import { findArtifacts } from '../../utils/artifacts';
import { createCheckoutBuildFunction } from '../functions/checkout';
import { createSubmissionEntityFunction } from '../functions/createSubmissionEntity';
import { createDownloadBuildFunction } from '../functions/download_build';
import { resolveIosArtifactPath } from '../functions/findAndUploadBuildArtifacts';
import { createInstallNodeModulesBuildFunction } from '../functions/installNodeModules';
import { createSetUpNpmrcBuildFunction } from '../functions/useNpmToken';

export function createEasSubmitBuildFunctionGroup(
  buildToolsContext: CustomBuildContext
): BuildFunctionGroup {
  return new BuildFunctionGroup({
    namespace: 'eas',
    id: 'submit',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'application_archive_path',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'build_id',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'profile',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'is_verbose_fastlane_enabled',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
      }),
    ],
    createBuildStepsFromFunctionGroupCall: (globalCtx, { inputs }) => {
      validateInputs(inputs, globalCtx.env);

      const buildId = String(inputs.build_id.value ?? globalCtx.env.EAS_BUILD_ID);
      const profile = String(inputs.profile.value ?? globalCtx.env.EAS_BUILD_PROFILE);

      const isVerboseFastlaneEnabled = isUndefined(inputs.is_verbose_fastlane_enabled.value)
        ? undefined
        : Boolean(inputs.is_verbose_fastlane_enabled.value);

      const applicationArchivePath = inputs.application_archive_path.value
        ? String(inputs.application_archive_path.value)
        : undefined;

      const commandOptions = {
        buildId,
        profile,
        isVerboseFastlaneEnabled,
        applicationArchivePath,
      };

      if (buildToolsContext.job.platform === Platform.IOS) {
        return createStepsForIosSubmit(commandOptions, globalCtx);
      } else {
        return createStepsForAndroidSubmit(commandOptions, globalCtx);
      }
    },
  });
}

function createFindExistingApplicationArtifactsBuildStep(
  globalCtx: BuildStepGlobalContext,
  platform: Platform,
  userApplicationArchivePath: string | undefined
): BuildStep {
  return new BuildStep(globalCtx, {
    displayName: 'Find existing application artifacts',
    id: 'local_artifacts',
    outputs: [
      new BuildStepOutput(globalCtx, {
        stepDisplayName: 'Find existing application artifacts',
        id: 'archive_path',
        required: false,
      }),
    ],
    fn: async (stepCtx, { outputs }) => {
      if (userApplicationArchivePath) {
        fs.accessSync(userApplicationArchivePath);
        stepCtx.logger.info(`Found existing application artifacts: ${userApplicationArchivePath}`);
        outputs.archive_path.set(userApplicationArchivePath);
        return;
      }
      const applicationArchivePatternOrPath = resolveIosArtifactPath(
        stepCtx.global.staticContext.job as Ios.Job
      );
      try {
        let applicationArchives: string[] = [];
        if (platform === Platform.ANDROID) {
          applicationArchives = await findArtifacts({
            rootDir: stepCtx.workingDirectory,
            patternOrPath: 'android/app/build/outputs/**/*.{apk,aab}',
            logger: stepCtx.logger,
          });
        } else {
          applicationArchives = await findArtifacts({
            rootDir: stepCtx.workingDirectory,
            patternOrPath: applicationArchivePatternOrPath,
            logger: stepCtx.logger,
          });
        }

        if (applicationArchives.length === 0) {
          stepCtx.logger.info('Did not find existing application artifacts, skipping...');
          return;
        }

        stepCtx.logger.info(
          `Found existing application artifacts:\n- ${applicationArchives.join('\n- ')}`
        );

        if (applicationArchives.length > 1) {
          throw new Error(
            'Found more than one application archive. Provide `application_archive_path` input.'
          );
        }

        outputs.archive_path.set(applicationArchives[0]);
      } catch (err: any) {
        stepCtx.logger.info({ err }, `Failed to find existing application artifacts.`);
      }
    },
  });
}

function validateInputs(inputs: BuildStepInputById, env: BuildStepEnv): void {
  const providedArgs = [inputs.build_id.value, inputs.application_archive_path.value].filter(
    Boolean
  );

  if (providedArgs.length > 1) {
    throw new Error(`Provide only one of build_id or application_archive_path.`);
  }

  if (!inputs.build_id.value && !env.EAS_BUILD_ID) {
    throw new Error('Provide build_id or set EAS_BUILD_ID environment variable.');
  }
}

function createStepsForIosSubmit(
  {
    buildId,
    profile: userProfile,
    isVerboseFastlaneEnabled,
    applicationArchivePath: userApplicationArchivePath,
  }: {
    buildId: string;
    profile: string | undefined;
    isVerboseFastlaneEnabled: boolean | undefined;
    applicationArchivePath: string | undefined;
  },
  globalCtx: BuildStepGlobalContext
): BuildStep[] {
  return [
    createCheckoutBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createSetUpNpmrcBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createInstallNodeModulesBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    new BuildStep(globalCtx, {
      displayName: 'Install additional tools',
      id: BuildStep.getNewId(),
      env: { HOMEBREW_NO_AUTO_UPDATE: '1' },
      fn: async (stepCtx, { env }) => {
        await spawnAsync('/opt/homebrew/bin/brew', ['install', 'jq'], {
          env,
          logger: stepCtx.logger,
          stdio: ['ignore', 'pipe', 'pipe'],
        });
      },
    }),
    createFindExistingApplicationArtifactsBuildStep(
      globalCtx,
      Platform.IOS,
      userApplicationArchivePath
    ),
    createDownloadBuildFunction().createBuildStepFromFunctionCall(globalCtx, {
      id: 'download_build',
      callInputs: {
        build_id: buildId,
        fail_on_error: false,
      },
    }),
    new BuildStep(globalCtx, {
      displayName: 'Prepare application to submit',
      name: 'prepare_application',
      id: 'prepare_application',
      outputs: [
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare application to submit',
          id: 'bundle_identifier',
          required: true,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare application to submit',
          id: 'artifact_path',
          required: true,
        }),
      ],
      command: `
      MAYBE_LOCAL_ARTIFACT='\${ steps.local_artifacts.archive_path }'
      MAYBE_DOWNLOADED_ARTIFACT='\${ steps.download_build.artifact_path }'

      if [ "$MAYBE_DOWNLOADED_ARTIFACT" ]; then
        ARTIFACT_PATH="$MAYBE_DOWNLOADED_ARTIFACT"
      elif [ "$MAYBE_LOCAL_ARTIFACT" ]; then
        ARTIFACT_PATH="$MAYBE_LOCAL_ARTIFACT"
      else
        echo 'Build not found -- no ipa file found in archive'
        exit 1
      fi

      echo "Artifact to upload: $ARTIFACT_PATH"
      set-output artifact_path "$ARTIFACT_PATH"

      BUNDLE_IDENTIFIER=$(unzip -p "$ARTIFACT_PATH" 'Payload/*.app/Info.plist' | plutil -convert xml1 -o - - | xpath -q -e '/plist/dict/key[.="CFBundleIdentifier"]/following-sibling::string[1]/text()' 2>/dev/null)
      echo "Bundle identifier: $BUNDLE_IDENTIFIER"
      set-output bundle_identifier "$BUNDLE_IDENTIFIER"
      `,
    }),
    new BuildStep(globalCtx, {
      displayName: 'Prepare credentials',
      id: 'prepare_asc_api_key',
      outputs: [
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'asc_app_identifier',
          required: true,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'is_verbose_fastlane_enabled',
          required: true,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'json_key_path',
          required: false,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'apple_id_username',
          required: false,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'apple_app_specific_password',
          required: false,
        }),
      ],
      command: `
      export EAS_DANGEROUS_OVERRIDE_IOS_BUNDLE_IDENTIFIER='\${ steps.prepare_application.bundle_identifier }'

      BUILD_PROFILE='${userProfile}'

      args="submit:internal --platform ios --id ${buildId}"

      if [ -n "$BUILD_PROFILE" ]; then
        args="$args --profile $BUILD_PROFILE"
      fi

      SUBMISSION_CONFIG=$(echo "$args" | xargs eas 2>/dev/null | jq '.config')

      ASC_APP_IDENTIFIER=$(echo $SUBMISSION_CONFIG | jq -r '.ascAppIdentifier')
      echo "Setting Apple App Identifier to $ASC_APP_IDENTIFIER"
      set-output asc_app_identifier "$ASC_APP_IDENTIFIER"

      SUBMISSION_CONFIG_IS_VERBOSE_FASTLANE_ENABLED=$(echo $SUBMISSION_CONFIG | jq -r '.isVerboseFastlaneEnabled')
      IS_VERBOSE_FASTLANE_ENABLED=${isVerboseFastlaneEnabled ?? '"$SUBMISSION_CONFIG_IS_VERBOSE_FASTLANE_ENABLED"'}

      echo "Setting is_verbose_fastlane_enabled to $IS_VERBOSE_FASTLANE_ENABLED"
      set-output is_verbose_fastlane_enabled "$IS_VERBOSE_FASTLANE_ENABLED"

      ASC_API_JSON_KEY=$(echo $SUBMISSION_CONFIG | jq -r '.ascApiJsonKey' | tr -d '\\000-\\037')
      if [ -z "$ASC_API_JSON_KEY" ]; then
        APPLE_ID_USERNAME=$(echo $SUBMISSION_CONFIG | jq -r '.appleIdUsername')
        APPLE_APP_SPECIFIC_PASSWORD=$(echo $SUBMISSION_CONFIG | jq -r '.appleAppSpecificPassword')
        echo "Setting Apple ID username to $APPLE_ID_USERNAME"
        set-output apple_id_username "$APPLE_ID_USERNAME"
        set-output apple_app_specific_password "$APPLE_APP_SPECIFIC_PASSWORD"
        exit 0
      else
        # validate
        if echo "$ASC_API_JSON_KEY" | jq empty > /dev/null 2>&1; then
          echo "ASC API Key JSON is valid."
        else
          echo 'SyntaxError: Invalid ascApiJsonKey format'
          exit 1
        fi

        # if the ascApiJsonKey is present, then we need to write it to a file.
        export id="$(uuidgen)"
        export json_key="ascApiJsonKey-$id.json"
        export json_key_path="$PWD/$json_key"
        echo "$ASC_API_JSON_KEY" > "$json_key_path"
        echo "Storing ASC API Key JSON in $json_key_path"
        set-output json_key_path "$json_key_path"
      fi
      `,
    }),
    new BuildStep(globalCtx, {
      displayName: 'Submit',
      id: BuildStep.getNewId(),
      command: `
      if [[ "\${ steps.prepare_asc_api_key.apple_id_username }" != "" && "\${ steps.prepare_asc_api_key.apple_app_specific_password }" != "" ]]; then
        export FASTLANE_USER="\${ steps.prepare_asc_api_key.apple_id_username }"
        export FASTLANE_APPLE_APPLICATION_SPECIFIC_PASSWORD="\${ steps.prepare_asc_api_key.apple_app_specific_password }"
      fi

      args="run pilot"
      args="$args ipa:\${ steps.prepare_application.artifact_path }"
      args="$args skip_waiting_for_build_processing:true"
      args="$args apple_id:\${ steps.prepare_asc_api_key.asc_app_identifier }"

      if [[ "\${ steps.prepare_asc_api_key.is_verbose_fastlane_enabled }" == 'true' ]]; then
        export DELIVER_ALTOOL_ADDITIONAL_UPLOAD_PARAMETERS='--output-format xml'
        args="$args --verbose"
      fi

      if [ "\${ steps.prepare_asc_api_key.json_key_path }" != "" ]; then
        args="$args api_key_path:\${ steps.prepare_asc_api_key.json_key_path }"
      fi

      echo "Executing \\\`fastlane $args\\\`"

      echo "$args" | xargs fastlane
      `,
    }),
    createSubmissionEntityFunction().createBuildStepFromFunctionCall(globalCtx, {
      callInputs: {
        build_id: buildId,
        apple_id_username: '${ steps.prepare_asc_api_key.apple_id_username }',
        asc_app_identifier: '${ steps.prepare_asc_api_key.asc_app_identifier }',
      },
    }),
  ];
}

function createStepsForAndroidSubmit(
  {
    buildId,
    profile: userProfile,
    isVerboseFastlaneEnabled,
    applicationArchivePath: userApplicationArchivePath,
  }: {
    buildId: string;
    profile: string | undefined;
    isVerboseFastlaneEnabled: boolean | undefined;
    applicationArchivePath: string | undefined;
  },
  globalCtx: BuildStepGlobalContext
): BuildStep[] {
  return [
    createCheckoutBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createSetUpNpmrcBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    createInstallNodeModulesBuildFunction().createBuildStepFromFunctionCall(globalCtx),
    new BuildStep(globalCtx, {
      displayName: 'Install additional tools',
      id: BuildStep.getNewId(),
      fn: async (stepCtx, { env }) =>
        await spawnAsync('sudo apt-get -y', ['install', 'jq'], {
          env,
          logger: stepCtx.logger,
          stdio: ['ignore', 'pipe', 'pipe'],
        }),
    }),
    createFindExistingApplicationArtifactsBuildStep(
      globalCtx,
      Platform.ANDROID,
      userApplicationArchivePath
    ),
    createDownloadBuildFunction().createBuildStepFromFunctionCall(globalCtx, {
      id: 'download_build',
      callInputs: {
        build_id: buildId,
        fail_on_error: false,
      },
    }),
    new BuildStep(globalCtx, {
      displayName: 'Prepare application to submit',
      id: 'prepare_application',
      outputs: [
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare application to submit',
          id: 'artifact_path',
          required: true,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare application to submit',
          id: 'archive_type',
          required: true,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare application to submit',
          id: 'package_id',
          required: true,
        }),
      ],
      command: `
      MAYBE_LOCAL_ARTIFACT='\${ steps.local_artifacts.archive_path }'
      MAYBE_DOWNLOADED_ARTIFACT='\${ steps.download_build.artifact_path }'

      if [ "$MAYBE_DOWNLOADED_ARTIFACT" ]; then
        ARTIFACT_PATH="$MAYBE_DOWNLOADED_ARTIFACT"
      elif [ "$MAYBE_LOCAL_ARTIFACT" ]; then
        ARTIFACT_PATH="$MAYBE_LOCAL_ARTIFACT"
      fi

      if [[ "$ARTIFACT_PATH" == *.apk ]]; then
        ARCHIVE_TYPE='apk'
      fi

      if [[ "$ARTIFACT_PATH" == *.aab ]]; then
        ARCHIVE_TYPE='aab'
      fi

      if [ -z "$ARCHIVE_TYPE" ]; then
          echo 'Build not found -- no aab or apk file found in archive'
          exit 1
      fi

      echo "Artifact to upload: $ARTIFACT_PATH ($ARCHIVE_TYPE)"

      if [[ "$ARTIFACT_PATH" == *.apk ]]; then
        PACKAGE_LINE=$(aapt2 dump badging "$ARTIFACT_PATH" | grep -E "package:\\s+name='([^']+)'")
        PACKAGE_ID=$(echo "\${PACKAGE_LINE##*=}" | tr -d "'")
      elif [[ "$ARTIFACT_PATH" == *.aab ]]; then
        PACKAGE_ID=$(bundletool dump manifest --bundle "$ARTIFACT_PATH" --xpath '/manifest/@package' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
      else
        echo 'could not find package id'
        exit 1
      fi

      echo "Package ID: $PACKAGE_ID"

      set-output package_id "$PACKAGE_ID"
      set-output archive_type "$ARCHIVE_TYPE"
      set-output artifact_path "$ARTIFACT_PATH"
      `,
    }),
    new BuildStep(globalCtx, {
      displayName: 'Prepare credentials',
      id: 'prepare_credentials',
      outputs: [
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'google_service_account_key_path',
          required: true,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'is_verbose_fastlane_enabled',
          required: false,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'changes_not_sent_for_review',
          required: false,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'track',
          required: false,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'release_status',
          required: false,
        }),
        new BuildStepOutput(globalCtx, {
          stepDisplayName: 'Prepare credentials',
          id: 'rollout',
          required: false,
        }),
      ],
      command: `
      export EAS_DANGEROUS_OVERRIDE_ANDROID_PACKAGE_ID='\${ steps.prepare_application.package_id }'

      args="submit:internal --platform ios --id ${buildId}"

      BUILD_PROFILE='${userProfile}'
      if [ -n "$BUILD_PROFILE" ]; then
        args="$args --profile $BUILD_PROFILE"
      fi

      SUBMISSION_CONFIG=$(echo "$args" | xargs eas 2>/dev/null | jq '.config')

      SUBMISSION_CONFIG_IS_VERBOSE_FASTLANE_ENABLED=$(echo $SUBMISSION_CONFIG | jq -r '.isVerboseFastlaneEnabled')
      IS_VERBOSE_FASTLANE_ENABLED=${isVerboseFastlaneEnabled ?? '"$SUBMISSION_CONFIG_IS_VERBOSE_FASTLANE_ENABLED"'}

      set-output is_verbose_fastlane_enabled "$IS_VERBOSE_FASTLANE_ENABLED"
      echo "Setting is_verbose_fastlane_enabled to $IS_VERBOSE_FASTLANE_ENABLED"

      if echo "$SUBMISSION_CONFIG" | jq --exit-status '.changesNotSentForReview' > /dev/null 2>&1; then
        CHANGES_NOT_SENT_FOR_REVIEW=$(echo "$SUBMISSION_CONFIG" | jq -r '.changesNotSentForReview')
        set-output changes_not_sent_for_review "$CHANGES_NOT_SENT_FOR_REVIEW"
        echo "Setting changes_not_sent_for_review to $CHANGES_NOT_SENT_FOR_REVIEW"
      fi

      if echo "$SUBMISSION_CONFIG" | jq --exit-status '.releaseStatus' > /dev/null 2>&1; then
        RELEASE_STATUS=$(echo "$SUBMISSION_CONFIG" | jq -r '.releaseStatus')
        set-output release_status "$RELEASE_STATUS"
        echo "Setting release_status to $RELEASE_STATUS"
      fi

      if echo "$SUBMISSION_CONFIG" | jq --exit-status '.rollout' > /dev/null 2>&1; then
        ROLLOUT=$(echo "$SUBMISSION_CONFIG" | jq -r '.rollout')
        set-output rollout "$ROLLOUT"
        echo "Setting rollout to $ROLLOUT"
      fi

      if echo "$SUBMISSION_CONFIG" | jq --exit-status '.track' > /dev/null 2>&1; then
        TRACK=$(echo "$SUBMISSION_CONFIG" | jq -r '.track')
        set-output track "$TRACK"
        echo "Setting track to $TRACK"
      fi

      GOOGLE_SERVICE_ACCOUNT_KEY_JSON=$(echo $SUBMISSION_CONFIG | jq -r '.googleServiceAccountKeyJson')
      echo "$GOOGLE_SERVICE_ACCOUNT_KEY_JSON" > "./service-account.json"
      echo "Storing Google Service Account JSON in ./service-account.json"
      set-output google_service_account_key_path "./service-account.json"
      `,
    }),
    new BuildStep(globalCtx, {
      displayName: 'Submit',
      id: BuildStep.getNewId(),
      command: `
      args='supply'
      RELEASE_STATUS='\${ steps.prepare_credentials.release_status }'
      ROLLOUT='\${ steps.prepare_credentials.rollout }'
      TRACK='\${ steps.prepare_credentials.track }'
      IS_VERBOSE_FASTLANE_ENABLED='\${ steps.prepare_credentials.is_verbose_fastlane_enabled }'

      if [ ! -z "$RELEASE_STATUS" ]; then
        args="$args --release_status $RELEASE_STATUS"
      fi
      if [ ! -z "$ROLLOUT" ]; then
        args="$args --rollout $ROLLOUT"
      fi
      if [ "$IS_VERBOSE_FASTLANE_ENABLED" == 'true' ]; then
        args="$args --verbose"
      fi

      args="$args --\${ steps.prepare_application.archive_type } \${ steps.prepare_application.artifact_path }"
      args="$args --track $TRACK"
      args="$args --json_key \${ steps.prepare_credentials.google_service_account_key_path }"
      args="$args --package \${ steps.prepare_application.package_id }"
      args="$args --changes_not_sent_for_review \${ steps.prepare_credentials.changes_not_sent_for_review }"

      echo "Executing \\\`fastlane $args\\\`"
      echo "$args" | xargs fastlane
      `,
    }),
    createSubmissionEntityFunction().createBuildStepFromFunctionCall(globalCtx, {
      callInputs: {
        build_id: buildId,
        track: '${ steps.prepare_credentials.track }',
        release_status: '${ steps.prepare_credentials.release_status }',
        rollout: '${ steps.prepare_credentials.rollout }',
        changes_not_sent_for_review: '${ steps.prepare_credentials.changes_not_sent_for_review }',
      },
    }),
  ];
}
