import assert from 'assert';

import { Platform } from '@expo/config';
import { BuildJob } from '@expo/eas-build-job';
import {
  BuildFunction,
  BuildStepInput,
  BuildStepInputValueTypeName,
  SpawnOptions,
  spawnAsync,
} from '@expo/steps';

import { PackageManager, resolvePackageManager } from '../../utils/packageManager';

import { installNodeModules } from './installNodeModules';

type PrebuildOptions = {
  clean?: boolean;
};

export function createPrebuildBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'prebuild',
    name: 'Prebuild',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'clean',
        defaultValue: false,
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
        required: true,
      }),
      BuildStepInput.createProvider({
        id: 'apple_team_id',
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
        required: false,
      }),
    ],
    fn: async (stepCtx, { inputs, env }) => {
      const { logger } = stepCtx;
      const appleTeamId = inputs.apple_team_id.value as string | undefined;
      const packageManager = resolvePackageManager(stepCtx.global.projectTargetDirectory);

      assert(stepCtx.global.staticContext.job, 'Job is not defined');
      const job = stepCtx.global.staticContext.job;
      assert(job.platform, 'Prebuild command is not supported in generic jobs.');
      const prebuildCommandArgs = getPrebuildCommandArgs(job, {
        clean: inputs.clean.value as boolean,
      });
      const argsWithExpo = ['expo', ...prebuildCommandArgs];
      const options: SpawnOptions = {
        cwd: stepCtx.workingDirectory,
        logger,
        stdio: 'pipe',
        env: {
          EXPO_IMAGE_UTILS_NO_SHARP: '1',
          ...env,
          ...(appleTeamId ? { APPLE_TEAM_ID: appleTeamId } : {}),
        },
      };
      if (packageManager === PackageManager.NPM) {
        await spawnAsync('npx', argsWithExpo, options);
      } else if (packageManager === PackageManager.YARN) {
        await spawnAsync('yarn', argsWithExpo, options);
      } else if (packageManager === PackageManager.PNPM) {
        await spawnAsync('pnpm', argsWithExpo, options);
      } else if (packageManager === PackageManager.BUN) {
        await spawnAsync('bun', argsWithExpo, options);
      } else {
        throw new Error(`Unsupported package manager: ${packageManager}`);
      }
      await installNodeModules(stepCtx, env);
    },
  });
}

function getPrebuildCommandArgs(job: BuildJob, { clean }: PrebuildOptions): string[] {
  if (job.experimental?.prebuildCommand) {
    return sanitizeUserDefinedPrebuildCommand(job.experimental.prebuildCommand, job.platform, {
      clean,
    });
  }
  return ['prebuild', '--no-install', '--platform', job.platform, ...(clean ? ['--clean'] : [])];
}

// TODO: deprecate prebuildCommand in eas.json
function sanitizeUserDefinedPrebuildCommand(
  userDefinedPrebuildCommand: string,
  platform: Platform,
  { clean }: PrebuildOptions
): string[] {
  let prebuildCommand = userDefinedPrebuildCommand;
  if (!prebuildCommand.match(/(?:--platform| -p)/)) {
    prebuildCommand = `${prebuildCommand} --platform ${platform}`;
  }
  if (clean) {
    prebuildCommand = `${prebuildCommand} --clean`;
  }
  const npxCommandPrefix = 'npx ';
  const expoCommandPrefix = 'expo ';
  const expoCliCommandPrefix = 'expo-cli ';
  if (prebuildCommand.startsWith(npxCommandPrefix)) {
    prebuildCommand = prebuildCommand.substring(npxCommandPrefix.length).trim();
  }
  if (prebuildCommand.startsWith(expoCommandPrefix)) {
    prebuildCommand = prebuildCommand.substring(expoCommandPrefix.length).trim();
  }
  if (prebuildCommand.startsWith(expoCliCommandPrefix)) {
    prebuildCommand = prebuildCommand.substring(expoCliCommandPrefix.length).trim();
  }
  return prebuildCommand.split(' ');
}
