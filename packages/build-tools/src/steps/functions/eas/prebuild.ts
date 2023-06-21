import { Platform } from '@expo/config';
import { Job } from '@expo/eas-build-job';
import { BuildFunction, BuildStepInput, BuildStepInputValueTypeName } from '@expo/steps';
import spawn from '@expo/turtle-spawn';

import { CustomBuildContext } from '../../../customBuildContext';
import { PackageManager, resolvePackageManager } from '../../../utils/packageManager';

import { installNodeModules } from './installNodeModules';

type PrebuildOptions = {
  clean?: boolean;
  skipDependencyUpdate?: string;
};

export function createPrebuildBuildFunction(ctx: CustomBuildContext): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'prebuild',
    name: 'Prebuild',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'skip_dependency_update',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
      BuildStepInput.createProvider({
        id: 'clean',
        defaultValue: false,
        allowedValueTypeName: BuildStepInputValueTypeName.BOOLEAN,
      }),
    ],
    fn: async (stepCtx, { inputs, env }) => {
      const { logger } = stepCtx;
      // TODO: make sure we can pass Apple Team ID to prebuild when adding credentials for custom builds
      const packageManager = resolvePackageManager(ctx.projectTargetDirectory);
      const prebuildCommandArgs = getPrebuildCommandArgs(ctx.job, {
        clean: inputs.clean.value as boolean,
        skipDependencyUpdate: inputs.skip_dependency_update.value as string,
      });
      const argsWithExpo = ['expo', ...prebuildCommandArgs];
      const options = {
        cwd: stepCtx.workingDirectory,
        logger,
        env: {
          EXPO_IMAGE_UTILS_NO_SHARP: '1',
          ...env,
        },
      };
      if (packageManager === PackageManager.NPM) {
        await spawn('npx', argsWithExpo, options);
      } else if (packageManager === PackageManager.YARN) {
        await spawn('yarn', argsWithExpo, options);
      } else if (packageManager === PackageManager.PNPM) {
        await spawn('pnpm', argsWithExpo, options);
      } else {
        throw new Error(`Unsupported package manager: ${packageManager}`);
      }
      await installNodeModules(stepCtx, ctx, env);
    },
  });
}

function getPrebuildCommandArgs(
  job: Job,
  { clean, skipDependencyUpdate }: PrebuildOptions
): string[] {
  if (job.experimental?.prebuildCommand) {
    return sanitizeUserDefinedPrebuildCommand(job.experimental.prebuildCommand, job.platform, {
      clean,
      skipDependencyUpdate,
    });
  }
  return [
    'prebuild',
    '--no-install',
    '--platform',
    job.platform,
    ...(skipDependencyUpdate ? ['--skip-dependency-update', skipDependencyUpdate] : []),
    ...(clean ? ['--clean'] : []),
  ];
}

// TODO: deprecate prebuildCommand in eas.json
function sanitizeUserDefinedPrebuildCommand(
  userDefinedPrebuildCommand: string,
  platform: Platform,
  { clean, skipDependencyUpdate }: PrebuildOptions
): string[] {
  let prebuildCommand = userDefinedPrebuildCommand;
  if (!prebuildCommand.match(/(?:--platform| -p)/)) {
    prebuildCommand = `${prebuildCommand} --platform ${platform}`;
  }
  if (skipDependencyUpdate) {
    prebuildCommand = `${prebuildCommand} --skip-dependency-update ${skipDependencyUpdate}`;
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
