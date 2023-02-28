import path from 'path';

import { createLogger } from '@expo/logger';
import arg from 'arg';

import { nullthrows } from '../utils/nullthrows.js';
import { BuildArtifactType } from '../BuildArtifacts.js';
import { BuildStepContext } from '../BuildStepContext.js';
import { saveArtifactToTemporaryDirectoryAsync } from '../BuildTemporaryFiles.js';

const args = arg({
  '--type': String,
});

const artifactPathArg = nullthrows(
  args._?.[0],
  'upload-artifact must be run with the artifact path, e.g. "upload-artifact path/to/app.ipa"'
);
const artifactPath = path.resolve(process.cwd(), artifactPathArg);

const logger = createLogger({
  name: 'eas-build',
  level: 'info',
});

const ctx = new BuildStepContext(
  nullthrows(process.env.__EXPO_STEPS_BUILD_ID, 'Set __EXPO_STEPS_BUILD_ID.'),
  logger,
  false,
  nullthrows(process.env.__EXPO_STEPS_WORKING_DIRECTORY, 'Set __EXPO_STEPS_BUILD_ID.')
);

const rawType = args['--type'] as BuildArtifactType | undefined;
const type = rawType ?? BuildArtifactType.APPLICATION_ARCHIVE;

saveArtifactToTemporaryDirectoryAsync(ctx, type, artifactPath).catch((err) => {
  console.error(`Failed preparing "${artifactPath}" for upload.`, err);
  process.exit(2);
});
