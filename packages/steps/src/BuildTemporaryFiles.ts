import path from 'path';
import fs from 'fs/promises';

import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from './BuildStepContext.js';
import { BuildArtifactType } from './BuildArtifacts.js';
import { BuildInternalError } from './errors/BuildInternalError.js';

export async function saveScriptToTemporaryFileAsync(
  ctx: BuildStepContext,
  stepId: string,
  scriptContents: string
): Promise<string> {
  const scriptsDir = getTemporaryScriptsDirPath(ctx, stepId);
  await fs.mkdir(scriptsDir, { recursive: true });
  const temporaryScriptPath = path.join(scriptsDir, `${uuidv4()}.sh`);
  await fs.writeFile(temporaryScriptPath, scriptContents);
  return temporaryScriptPath;
}

export async function saveArtifactToTemporaryDirectoryAsync(
  ctx: BuildStepContext,
  type: BuildArtifactType,
  artifactPath: string
): Promise<string> {
  let targetArtifactPath: string;
  if (type === BuildArtifactType.APPLICATION_ARCHIVE) {
    targetArtifactPath = path.join(
      getTemporaryApplicationArchiveDirPath(ctx),
      path.basename(artifactPath)
    );
  } else if (type === BuildArtifactType.BUILD_ARTIFACT) {
    targetArtifactPath = path.join(
      getTemporaryBuildArtifactsDirPath(ctx),
      path.basename(artifactPath)
    );
  } else {
    throw new BuildInternalError(`Uploading artifacts of type "${type}" is not implemented.`);
  }

  await fs.mkdir(path.dirname(targetArtifactPath), { recursive: true });
  await fs.copyFile(artifactPath, targetArtifactPath);
  return targetArtifactPath;
}

export async function createTemporaryOutputsDirectoryAsync(
  ctx: BuildStepContext,
  stepId: string
): Promise<string> {
  const directory = getTemporaryOutputsDirPath(ctx, stepId);
  await fs.mkdir(directory, { recursive: true });
  return directory;
}

export async function findArtifactsByTypeAsync(
  ctx: BuildStepContext,
  type: BuildArtifactType
): Promise<string[]> {
  let artifactsDirPath: string;
  if (type === BuildArtifactType.APPLICATION_ARCHIVE) {
    artifactsDirPath = getTemporaryApplicationArchiveDirPath(ctx);
  } else if (type === BuildArtifactType.BUILD_ARTIFACT) {
    artifactsDirPath = getTemporaryBuildArtifactsDirPath(ctx);
  } else {
    throw new BuildInternalError(`Finding artifacts of type "${type}" is not implemented.`);
  }
  try {
    const filenames = await fs.readdir(artifactsDirPath);
    return filenames.map((filename) => path.join(artifactsDirPath, filename));
  } catch (err) {
    ctx.logger.debug(
      { err },
      `Failed reading artifacts of type "${type}" from "${artifactsDirPath}". The directory probably doesn't exist.`
    );
    return [];
  }
}

export async function cleanUpStepTemporaryDirectoriesAsync(
  ctx: BuildStepContext,
  stepId: string
): Promise<void> {
  if (ctx.skipCleanup) {
    return;
  }
  const stepTemporaryDirectory = getTemporaryStepDirPath(ctx, stepId);
  await fs.rm(stepTemporaryDirectory, { recursive: true });
  ctx.logger.debug({ stepTemporaryDirectory }, 'Removed step temporary directory');
}

export async function cleanUpWorkflowTemporaryDirectoriesAsync(
  ctx: BuildStepContext
): Promise<void> {
  if (ctx.skipCleanup) {
    return;
  }

  const temporaryDirectories: string[] = [getTemporaryArtifactsDirPath(ctx)];
  const rmPromises = temporaryDirectories.map((dir) => fs.rm(dir, { recursive: true }));
  await Promise.all(rmPromises);
  ctx.logger.debug({ temporaryDirectories }, 'Removed temporary directories');
}

function getTemporaryStepDirPath(ctx: BuildStepContext, stepId: string): string {
  return path.join(ctx.baseWorkingDirectory, 'steps', stepId);
}

function getTemporaryScriptsDirPath(ctx: BuildStepContext, stepId: string): string {
  return path.join(getTemporaryStepDirPath(ctx, stepId), 'scripts');
}

function getTemporaryOutputsDirPath(ctx: BuildStepContext, stepId: string): string {
  return path.join(getTemporaryStepDirPath(ctx, stepId), 'outputs');
}

function getTemporaryApplicationArchiveDirPath(ctx: BuildStepContext): string {
  return path.join(getTemporaryArtifactsDirPath(ctx), 'application-archive');
}

function getTemporaryBuildArtifactsDirPath(ctx: BuildStepContext): string {
  return path.join(getTemporaryArtifactsDirPath(ctx), 'build-artifacts');
}

function getTemporaryArtifactsDirPath(ctx: BuildStepContext): string {
  return path.join(ctx.baseWorkingDirectory, 'artifacts');
}
