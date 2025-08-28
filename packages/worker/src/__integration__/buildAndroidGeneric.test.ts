import { hostname } from 'os';

import { ArchiveSourceType } from '@expo/eas-build-job';
import WebSocket from 'ws';

import logger from '../logger';
import env from '../utils/env';
import { cleanUpWorkingdir, prepareWorkingdir } from '../workingdir';
import startWsServer from '../ws';

import { WsHelper, unreachableCode, ANDROID_CREDENTIALS } from './utils';

const MAX_BUILD_TIME = 30 * 60 * 1000; // 30 min

jest.setTimeout(MAX_BUILD_TIME);

const projectUrl = env('TURTLE_TEST_PROJECT_URL');

const buildId = 'f38532aa-81a8-4db7-915f-6e7afe46e22f';

jest.mock('../upload');
jest.mock('../service', () => {
  return function () {
    const BuildService = new (jest.requireActual('../service').default)();
    BuildService.checkForHangingWorker = jest.fn(async () => {});
    return BuildService;
  };
});
jest.mock('../config', () => {
  const config = jest.requireActual('../config').default;
  return {
    ...config,
    buildId: 'f38532aa-81a8-4db7-915f-6e7afe46e22f',
  };
});

describe('Android generic build', () => {
  let port: number;
  let server: WebSocket.Server;

  beforeEach(async () => {
    await prepareWorkingdir();
    port = Math.floor(Math.random() * 10000 + 10000);
    server = startWsServer(port);
    logger.debug(`Listening on port ${port}`);
  });

  afterEach(async () => {
    await new Promise((res) => {
      server.close(res);
    });
  });

  afterAll(async () => {
    await cleanUpWorkingdir();
  });

  describe('successful build', () => {
    it('should build aab', async () => {
      const ws = new WebSocket(`ws://localhost:${port}?expo_vm_name=${hostname()}`);
      const helper = new WsHelper(ws);

      let successPromiseResolve: () => void;
      const successPromise = new Promise<void>((res) => {
        successPromiseResolve = res;
      });
      const onMessage = jest.fn((message: any) => {
        logger.debug('message received');
        try {
          expect(message).toBeTruthy();
          expect(message.type).toBe('success');
        } catch (err) {
          throw err;
        } finally {
          successPromiseResolve();
        }
      });
      const openPromise = helper.onOpen();
      helper.onMessage(onMessage);

      await openPromise;
      const messageTimeout = setTimeout(() => {
        unreachableCode('build timeout');
      }, MAX_BUILD_TIME);
      ws.send(
        JSON.stringify({
          type: 'dispatch',
          buildId,
          job: {
            mode: 'build',
            secrets: {
              buildCredentials: ANDROID_CREDENTIALS,
            },
            platform: 'android',
            type: 'generic',
            projectArchive: {
              type: ArchiveSourceType.URL,
              url: projectUrl,
            },
            projectRootDirectory: './generic',
            gradleCommand: ':app:bundleRelease',
            applicationArchivePath: 'android/app/build/outputs/**/*.{apk,aab}',
          },
          initiatingUserId: '14367e1b-26fc-4c00-aedb-0629d78f8286',
          metadata: {
            trackingContext: {},
            buildProfile: 'production',
          },
        })
      );

      await successPromise;
      clearTimeout(messageTimeout);

      const closePromise = helper.onClose();
      ws.send(JSON.stringify({ type: 'close' }));
      await closePromise;

      expect(helper.onErrorCb).not.toHaveBeenCalled();
      expect(helper.onOpenCb).toHaveBeenCalled();
      expect(helper.onMessageCb).toHaveBeenCalled();
      expect(helper.onCloseCb).toHaveBeenCalled();
    });
  });
});
