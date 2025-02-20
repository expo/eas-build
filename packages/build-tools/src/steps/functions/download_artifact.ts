import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  BuildStepOutput,
} from '@expo/steps';

export function createDownloadArtifactsFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'download_artifacts',
    name: 'Download artifacts',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'application_archive_url',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    outputProviders: [
      BuildStepOutput.createProvider({
        id: 'artifact_path',
        required: false,
      }),
    ],
    command: `
    APPLICATION_ARCHIVE_URL='\${ inputs.application_archive_url }'
    if [ -z "$APPLICATION_ARCHIVE_URL" ]; then
        echo "No application archive URL provided"
        exit 0
    fi
    curl --remote-name --location --fail --silent --show-error "$APPLICATION_ARCHIVE_URL"
    ARCHIVE_NAME=$(basename "$APPLICATION_ARCHIVE_URL")
    echo "Downloaded application archive to $ARCHIVE_NAME"

    EXTRACTOIN_DIR=$(mktemp -d)

    if [[ "$ARCHIVE_NAME" == *.tar.gz || "$ARCHIVE_NAME" == *.tgz ]]; then
        tar -xf "$ARCHIVE_NAME" -C "$EXTRACTION_DIR"
        echo "Extracted application archive to $EXTRACTION_DIR"
    fi

    if [ -d "$EXTRACTION_DIR" ]; then
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

        set-output artifact_path "$ARTIFACT_PATH"
        echo "Set output artifact path to $ARTIFACT_PATH"
    else
        set-output artifact_path "$ARCHIVE_NAME"
        echo "Set output artifact path to $ARCHIVE_NAME"
    fi
    `,
  });
}
