import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import { Job, Metadata } from '@expo/eas-build-job';
import {
  BuildRuntimePlatform,
  BuildStepGlobalContext,
  Cache,
  DynamicCacheManager,
  ExternalBuildContextProvider,
} from '@expo/steps';
import { anything, capture, instance, mock, reset, verify, when } from 'ts-mockito';

import { createLogger } from '../../../__mocks__/@expo/logger';
import { createTestIosJob } from '../../../__tests__/utils/job';
import { createMockLogger } from '../../../__tests__/utils/logger';
import { BuildContext } from '../../../context';
import { CustomBuildContext } from '../../../customBuildContext';
import { createRestoreCacheBuildFunction, createSaveCacheBuildFunction } from '../cache';

const dynamicCacheManagerMock = mock<DynamicCacheManager>();
const dynamicCacheManager = instance(dynamicCacheManagerMock);

const buildCtx = new BuildContext(createTestIosJob({}), {
  env: {},
  logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
  logger: createMockLogger(),
  uploadArtifact: jest.fn(),
  workingdir: '',
  dynamicCacheManager,
});
const customContext = new CustomBuildContext(buildCtx);

const cacheSaveBuildFunction = createSaveCacheBuildFunction(customContext);
const cacheRestoreBuildFunction = createRestoreCacheBuildFunction(customContext);

const providerMock = mock<ExternalBuildContextProvider>();

const initialCache: Cache = { disabled: false, clear: false, paths: [] };

const provider = instance(providerMock);

let ctx: BuildStepGlobalContext;

describe('cache functions', () => {
  let key: string;
  let paths: string[];
  beforeEach(async () => {
    key = '${ hashFiles("./src/*")  }-value';
    paths = ['path1', 'path2'];
    reset(dynamicCacheManagerMock);
    reset(providerMock);

    const projectSourceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'project-'));
    when(providerMock.logger).thenReturn(createLogger());
    when(providerMock.runtimePlatform).thenReturn(BuildRuntimePlatform.LINUX);
    when(providerMock.staticContext()).thenReturn({
      metadata: {} as Metadata,
      env: {},
      job: { cache: initialCache } as Job,
    });
    when(providerMock.projectSourceDirectory).thenReturn(projectSourceDirectory);
    when(providerMock.defaultWorkingDirectory).thenReturn(projectSourceDirectory);
    when(providerMock.projectTargetDirectory).thenReturn(projectSourceDirectory);

    ctx = new BuildStepGlobalContext(provider, false);

    await fs.mkdir(path.join(projectSourceDirectory, 'src'));
    await fs.writeFile(path.join(projectSourceDirectory, 'src', 'path1'), 'placeholder');
    await fs.writeFile(path.join(projectSourceDirectory, 'src', 'path2'), 'placeholder');
  });

  describe('cacheRestoreBuildFunction', () => {
    test('has correct identifiers', () => {
      expect(cacheRestoreBuildFunction.id).toBe('restore-cache');
      expect(cacheRestoreBuildFunction.namespace).toBe('eas');
      expect(cacheRestoreBuildFunction.name).toBe('Restore Cache');
    });

    test('restores cache if it exists', async () => {
      const buildStep = cacheRestoreBuildFunction.createBuildStepFromFunctionCall(ctx, {
        callInputs: { key, paths },
      });

      when(providerMock.defaultWorkingDirectory).thenReturn('/tmp');

      await buildStep.executeAsync();

      verify(dynamicCacheManagerMock.restoreCache(anything(), anything())).once();

      const [, cache] = capture(dynamicCacheManagerMock.restoreCache).first();
      expect(cache.key).toMatch(/^\w+-value/);
      expect(cache.paths).toStrictEqual(paths);
    });
  });

  describe('cacheSaveBuildFunction', () => {
    test('has correct identifiers', () => {
      expect(cacheSaveBuildFunction.id).toBe('save-cache');
      expect(cacheSaveBuildFunction.namespace).toBe('eas');
      expect(cacheSaveBuildFunction.name).toBe('Save Cache');
    });

    test('saves cache if it does not exist', async () => {
      const buildStep = cacheSaveBuildFunction.createBuildStepFromFunctionCall(ctx, {
        callInputs: { key, paths },
      });

      await buildStep.executeAsync();

      verify(dynamicCacheManagerMock.saveCache(anything(), anything())).once();

      const [, cache] = capture(dynamicCacheManagerMock.saveCache).first();
      expect(cache?.key).toMatch(/^\w+-value/);
    });
  });
});
