import path from 'path';

import { Job } from '@expo/eas-build-job';
import spawn from '@expo/turtle-spawn';
import fs from 'fs-extra';

import { BuildContext } from '../context';

export enum Hook {
  PRE_INSTALL = 'eas-build-pre-install',
  POST_INSTALL = 'eas-build-post-install',
  PRE_UPLOAD_ARTIFACTS = 'eas-build-pre-upload-artifacts',
}

interface PackageJson {
  scripts?: Record<string, string>;
}

export async function runHookIfPresent<TJob extends Job>(
  ctx: BuildContext<TJob>,
  hook: Hook
): Promise<void> {
  const projectDir = ctx.reactNativeProjectDirectory;
  let packageJson: PackageJson | undefined;
  try {
    packageJson = await readPackageJson(projectDir);
  } catch (err) {
    ctx.logger.warn(`Failed to parse or read package.json: ${err.message}`);
    return;
  }
  if (packageJson.scripts?.[hook]) {
    ctx.logger.info(`Script '${hook}' is present in package.json, running it...`);
    await spawn(ctx.packageManager, ['run', hook], {
      cwd: projectDir,
      logger: ctx.logger,
      env: ctx.env,
    });
  }
}

async function readPackageJson(projectDir: string): Promise<PackageJson> {
  const packageJsonPath = path.join(projectDir, 'package.json');
  if (!(await fs.pathExists(packageJsonPath))) {
    throw new Error(`package.json does not exist in ${projectDir}`);
  }
  const contents = await fs.readFile(packageJsonPath, 'utf-8');
  return JSON.parse(contents);
}
