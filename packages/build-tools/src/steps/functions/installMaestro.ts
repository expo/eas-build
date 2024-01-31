import assert from 'assert';
import path from 'path';

import fs from 'fs-extra';
import {
  BuildFunction,
  BuildRuntimePlatform,
  BuildStepGlobalContext,
  BuildStepInput,
  BuildStepInputValueTypeName,
} from '@expo/steps';
import spawn from '@expo/turtle-spawn';
import { bunyan } from '@expo/logger';

export function createInstallMaestroBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'install_maestro',
    name: 'Install Maestro',
    inputProviders: [
      BuildStepInput.createProvider({
        id: 'maestro_version',
        required: false,
        allowedValueTypeName: BuildStepInputValueTypeName.STRING,
      }),
    ],
    fn: async ({ logger, global }, { inputs, env }) => {
      const requestedMaestroVersion = inputs.maestro_version.value as string | undefined;
      const currentMaestroVersion = await getMaestroVersion();

      // When not running in EAS Build VM, do not modify local environment.
      if (env.EAS_BUILD_RUNNER !== 'eas-build') {
        const currentIsJavaInstalled = await isJavaInstalled();
        const currentIsIdbInstalled = await isIdbInstalled();

        if (!currentIsJavaInstalled) {
          logger.warn(
            'It seems Java is not installed. It is required to run Maestro. If the job fails, this may be the reason.'
          );
          logger.info('');
        }

        if (!currentIsIdbInstalled) {
          logger.warn(
            'It seems IDB is not installed. Maestro requires it to run flows on iOS Simulator. If the job fails, this may be the reason.'
          );
          logger.info('');
        }

        if (!currentMaestroVersion) {
          logger.warn(
            'It seems Maestro is not installed. Please install Maestro manually and rerun the job.'
          );
          logger.info('');
        }

        // Guide is helpful in these two cases, it doesn't mention Java.
        if (!currentIsIdbInstalled || !currentMaestroVersion) {
          logger.warn(
            'For more info, check out Maestro installation guide: https://maestro.mobile.dev/getting-started/installing-maestro'
          );
        }

        if (currentMaestroVersion) {
          logger.info(`Maestro ${currentMaestroVersion} is ready.`);
        }

        return;
      }

      if (!(await isJavaInstalled())) {
        if (global.runtimePlatform === BuildRuntimePlatform.DARWIN) {
          logger.info('Installing Java');
          await installJavaFromGcs({ logger });
        } else {
          // We expect Java to be pre-installed on Linux images,
          // so this should only happen when running this step locally.
          // We don't need to support installing Java on local computers.
          throw new Error('Please install Java manually and rerun the job.');
        }
      }

      // IDB is only a requirement on macOS.
      if (global.runtimePlatform === BuildRuntimePlatform.DARWIN && !(await isIdbInstalled())) {
        logger.info('Installing IDB');
        await installIdbFromBrew({ global, logger });
      }

      // Skip installing if the input sets a specific Maestro version to install
      // and it is already installed which happens when developing on a local computer.
      if (!currentMaestroVersion || requestedMaestroVersion !== currentMaestroVersion) {
        await installMaestro({
          version: requestedMaestroVersion,
          global,
          logger,
        });
      }

      const maestroVersion = await getMaestroVersion();
      assert(maestroVersion, 'Failed to ensure Maestro is installed.');
      logger.info(`Maestro ${maestroVersion} is ready.`);
    },
  });
}

async function getMaestroVersion(): Promise<string | null> {
  try {
    const maestroVersion = await spawn('maestro', ['--version'], { stdio: 'pipe' });
    return maestroVersion.stdout.trim();
  } catch {
    return null;
  }
}

async function installMaestro({
  global,
  version,
  logger,
}: {
  version?: string;
  logger: bunyan;
  global: BuildStepGlobalContext;
}): Promise<void> {
  logger.info('Fetching install script');
  const tempDirectory = await fs.mkdtemp('install_maestro');
  try {
    const installMaestroScriptResponse = await fetch('https://get.maestro.mobile.dev');
    const installMaestroScript = await installMaestroScriptResponse.text();
    const installMaestroScriptFilePath = path.join(tempDirectory, 'install_maestro.sh');
    await fs.writeFile(installMaestroScriptFilePath, installMaestroScript, {
      mode: 0o777,
    });
    logger.info('Installing Maestro');
    await spawn(installMaestroScriptFilePath, [], {
      logger,
      env: {
        ...global.env,
        MAESTRO_VERSION: version,
      },
    });
  } finally {
    await fs.remove(tempDirectory);
  }
}

async function isIdbInstalled(): Promise<boolean> {
  try {
    await spawn('idb', ['-h'], { ignoreStdio: true });
    return true;
  } catch {
    return false;
  }
}

async function installIdbFromBrew({
  global,
  logger,
}: {
  global: BuildStepGlobalContext;
  logger: bunyan;
}): Promise<void> {
  // Unfortunately our Mac images sometimes have two Homebrew
  // installations. We should use the ARM64 one, located in /opt/homebrew.
  const brewPath = '/opt/homebrew/bin/brew';
  const env = {
    ...global.env,
    HOMEBREW_NO_AUTO_UPDATE: '1',
  };

  await spawn(brewPath, ['tap', 'facebook/fb'], {
    env,
    logger,
  });
  await spawn(brewPath, ['install', 'idb-companion'], {
    env,
    logger,
  });
}

async function isJavaInstalled(): Promise<boolean> {
  try {
    await spawn('java', ['-version'], { ignoreStdio: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Installs Java 11 from a file uploaded manually to GCS as cache.
 * Should not be run outside of EAS Build VMs not to break users' environments.
 */
async function installJavaFromGcs({ logger }: { logger: bunyan }): Promise<void> {
  const downloadUrl =
    'https://storage.googleapis.com/turtle-v2/zulu11.68.17-ca-jdk11.0.21-macosx_aarch64.dmg';
  const filename = path.basename(downloadUrl);
  const tempDirectory = await fs.mkdtemp('install_java');
  try {
    const installerPath = path.join(tempDirectory, filename);
    logger.info('Downloading Java installer');
    // This is simpler than piping body into a write stream with node-fetch.
    await spawn('curl', ['--output', installerPath, downloadUrl]);

    const installerMountDirectory = path.join(tempDirectory, 'mountpoint');
    await fs.mkdir(installerMountDirectory);
    logger.info('Mounting Java installer');
    await spawn(
      'hdiutil',
      ['attach', installerPath, '-noverify', '-mountpoint', installerMountDirectory],
      { logger }
    );

    logger.info('Installing Java');
    await spawn(
      'sudo',
      [
        'installer',
        '-pkg',
        path.join(installerMountDirectory, 'Double-Click to Install Azul Zulu JDK 11.pkg'),
        '-target',
        '/',
      ],
      { logger }
    );
  } finally {
    await fs.remove(tempDirectory);
  }
}
