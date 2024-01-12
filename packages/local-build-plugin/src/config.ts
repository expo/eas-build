import path from 'path';

import { v4 as uuidv4 } from 'uuid';
import envPaths from 'env-paths';

const { temp } = envPaths('eas-build-local');

const envLoggerLevel = process.env.EAS_LOCAL_BUILD_LOGGER_LEVEL;
const envWorkingdir = process.env.EAS_LOCAL_BUILD_WORKINGDIR;
const envSkipCleanup = process.env.EAS_LOCAL_BUILD_SKIP_CLEANUP;
const envSkipNativeBuild = process.env.EAS_LOCAL_BUILD_SKIP_NATIVE_BUILD;
const envArtifactsDir = process.env.EAS_LOCAL_BUILD_ARTIFACTS_DIR;
const envArtifactPath = process.env.EAS_LOCAL_BUILD_ARTIFACT_PATH;

if (envLoggerLevel && !['debug', 'info', 'warn', 'error'].includes(envLoggerLevel)) {
  throw new Error(
    'Invalid value for EAS_LOCAL_BUILD_LOGGER_LEVEL, one of info, warn, or error is expected'
  );
}

export default {
  workingdir: envWorkingdir ?? path.join(temp, uuidv4()),
  skipCleanup: envSkipCleanup === '1',
  skipNativeBuild: envSkipNativeBuild === '1',
  artifactsDir: envArtifactsDir ?? process.cwd(),
  artifactPath: envArtifactPath,
  logger: {
    level: (envLoggerLevel ?? 'info') as 'debug' | 'info' | 'warn' | 'error',
  },
};
