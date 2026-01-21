import { BuildFunction } from '@expo/steps';
import spawn from '@expo/turtle-spawn';
import { asyncResult } from '@expo/results';

import { sleepAsync } from '../../utils/retry';

const CVDR_READY_TIMEOUT_MS = 60_000;
const CVDR_READY_POLL_INTERVAL_MS = 2_000;

export function createStartCuttlefishDeviceBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'start_cuttlefish_device',
    name: 'Start Cuttlefish Device',
    __metricsId: 'eas/start_cuttlefish_device',
    fn: async ({ logger }, { env }) => {
      const dependencyCheck = await asyncResult(
        Promise.all([
          spawn('docker', ['--version'], { env, logger }),
          spawn('cvdr', ['--help'], { env, logger }),
        ])
      );
      if (!dependencyCheck.ok) {
        logger.error(
          dependencyCheck.reason,
          'Cuttlefish requires Docker and cvdr, which are only available on the latest Android worker image. Add `image: latest` to your job configuration to use the latest image.'
        );
        throw new Error(
          'Cuttlefish device start is only supported on the latest Android worker image.'
        );
      }

      logger.info('Starting Cuttlefish Orchestrator container');

      await spawn(
        'docker',
        [
          'run',
          '--detach',
          '--name',
          'cuttlefish-orchestrator',
          '--publish',
          '8080:8080',
          '--env',
          'CONFIG_FILE=/conf.toml',
          '--volume',
          '/etc/cuttlefish/conf.toml:/conf.toml',
          '--volume',
          '/var/run/docker.sock:/var/run/docker.sock',
          '--tty',
          'us-docker.pkg.dev/android-cuttlefish-artifacts/cuttlefish-orchestration/cuttlefish-cloud-orchestrator:unstable',
        ],
        { env, logger }
      );

      const readyDeadline = Date.now() + CVDR_READY_TIMEOUT_MS;
      let cvdrReady = false;
      while (Date.now() < readyDeadline) {
        const result = await asyncResult(spawn('cvdr', ['list'], { env, logger }));
        if (result.ok) {
          cvdrReady = true;
          logger.info('Cuttlefish Orchestrator is ready!');
          break;
        }
        await sleepAsync(CVDR_READY_POLL_INTERVAL_MS);
      }

      if (!cvdrReady) {
        throw new Error('Timed out waiting for Cuttlefish Orchestrator to be ready.');
      }

      logger.info('Creating CVD');
      await spawn('cvdr', ['create'], { env, logger });

      logger.info('Connecting to device...');
      await spawn('adb', ['devices'], { env, logger });
      await spawn('adb', ['shell', 'input', 'keyevent', '82'], { env, logger });
    },
  });
}
