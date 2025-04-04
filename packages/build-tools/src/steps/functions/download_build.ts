import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  BuildStepOutput,
} from '@expo/steps';

export function createDownloadBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'download_build',
    name: 'Download build',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'build_id',
        required: true,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'fail_on_error',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
        defaultValue: true,
      }),
    ],
    outputProviders: [
      BuildStepOutput.createProvider({
        id: 'artifact_path',
        required: false,
      }),
    ],
    command: `
    BUILD_ID='\${ inputs.build_id }'
    FAIL_ON_ERROR='\${ inputs.fail_on_error }'
    APPLICATION_ARCHIVE_URL="\${__API_SERVER_URL%/}/v2/artifacts/eas/$BUILD_ID"

    echo "Downloading build from $APPLICATION_ARCHIVE_URL"
    if ! STORED_FILE_URL=$(curl --remote-name --retry 3 --retry-delay 20 --location --fail -w %{url_effective} --silent --show-error "$APPLICATION_ARCHIVE_URL"); then
    if [ "$FAIL_ON_ERROR" = "true" ]; then
        echo "File not available."
        exit 1
        fi
      echo "File not available, skipping..."
      exit 0
    fi
    echo "done."
    URL_ARCHIVE_NAME=$(basename "$APPLICATION_ARCHIVE_URL")
    ARCHIVE_NAME=$(basename "\${STORED_FILE_URL%%\\?*}")
    mv $URL_ARCHIVE_NAME $ARCHIVE_NAME
    echo "Downloaded application archive to $ARCHIVE_NAME"

    if [[ "$ARCHIVE_NAME" == *.tar.gz || "$ARCHIVE_NAME" == *.tgz ]]; then
        EXTRACTION_DIR=$(mktemp -d)
        echo "Extracting application archive..."
        tar -xf "$ARCHIVE_NAME" -C "$EXTRACTION_DIR"
        echo "Extracted application archive to $EXTRACTION_DIR"
    fi

    if [ -d "$EXTRACTION_DIR" ]; then
        mkdir -p "artifacts"

        find "$EXTRACTION_DIR" -name "*.ipa" -exec mv {} "artifacts/" ';'
        ARTIFACT_PATH=$(find . -name '*.ipa')

        if [ -z "$ARTIFACT_PATH" ]; then
            find "$EXTRACTION_DIR" -name "*.apk" -exec mv {} "artifacts/" ';'
            ARTIFACT_PATH="$(find . -name '*.apk')"
        fi

        if [ -z "$ARTIFACT_PATH" ]; then
            find "$EXTRACTION_DIR" -name "*.aab" -exec mv {} "artifacts/" ';'
            ARTIFACT_PATH="$(find . -name '*.aab')"
        fi
    else
        ARTIFACT_PATH=$ARCHIVE_NAME
    fi
    ARTIFACT_PATH=$(realpath "$ARTIFACT_PATH")
    set-output artifact_path "$ARTIFACT_PATH"
    echo "Set output artifact path to $ARTIFACT_PATH"
    `,
  });
}
