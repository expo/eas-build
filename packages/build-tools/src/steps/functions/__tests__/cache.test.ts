import fs from 'fs/promises';
import os from 'os';
import path from 'path';

import {
  BuildRuntimePlatform,
  BuildStepGlobalContext,
  ExternalBuildContextProvider,
  CacheManager,
} from '@expo/steps';
import { anything, capture, instance, mock, reset, verify, when } from 'ts-mockito';

import { createLogger } from '../../../__mocks__/@expo/logger';
import { createRestoreCacheBuildFunction, createSaveCacheBuildFunction } from '../cache';

const cacheSaveBuildFunction = createSaveCacheBuildFunction();
const cacheRestoreBuildFunction = createRestoreCacheBuildFunction();

const providerMock = mock<ExternalBuildContextProvider>();
const cacheManagerMock = mock<CacheManager>();

const cacheManager = instance(cacheManagerMock);
const initialCache = { downloadUrls: {} };

const provider = instance(providerMock);

let ctx: BuildStepGlobalContext;

const existingKey =
  'c7d8e33243968f8675ec0463ad89e11c1e754723695ab9b23dfb8f9ddd389a28-value-8b6e2366e2a2ff8b43556a1dcc5f1cf97ddcf4cdf3c8f9a6d54e0efe2e747922';

describe('cache functions', () => {
  let key: string;
  let paths: string[];
  beforeEach(async () => {
    key = '${ hashFiles("./src/*")  }-value';
    paths = ['path1', 'path2'];
    reset(cacheManagerMock);
    reset(providerMock);

    const projectSourceDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'project-'));
    when(providerMock.logger).thenReturn(createLogger());
    when(providerMock.runtimePlatform).thenReturn(BuildRuntimePlatform.LINUX);
    when(providerMock.staticContext()).thenReturn({ some: 'key', job: { cache: initialCache } });
    when(providerMock.cacheManager).thenReturn(cacheManager);
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
      when(cacheManagerMock.restoreCache(anything(), anything()));
      initialCache.downloadUrls = { [existingKey]: 'url' };

      const buildStep = cacheRestoreBuildFunction.createBuildStepFromFunctionCall(ctx, {
        callInputs: { key, paths },
      });

      when(providerMock.defaultWorkingDirectory).thenReturn('/tmp');

      await buildStep.executeAsync();

      verify(cacheManagerMock.restoreCache(anything(), anything())).once();

      const [, cache] = capture(cacheManagerMock.restoreCache).first();
      expect(cache.key).toMatch(/^\w+-value/);
      expect(cache.paths).toStrictEqual(paths);
    });

    test("doesn't restore cache if it doesn't exist", async () => {
      when(cacheManagerMock.restoreCache(anything(), anything()));
      initialCache.downloadUrls = { invalidkey: 'url' };

      const buildStep = cacheRestoreBuildFunction.createBuildStepFromFunctionCall(ctx, {
        callInputs: { key, paths },
      });

      await buildStep.executeAsync();

      verify(cacheManagerMock.restoreCache(anything(), anything())).never();
    });
  });

  describe('cacheSaveBuildFunction', () => {
    test('has correct identifiers', () => {
      expect(cacheSaveBuildFunction.id).toBe('save-cache');
      expect(cacheSaveBuildFunction.namespace).toBe('eas');
      expect(cacheSaveBuildFunction.name).toBe('Save Cache');
    });

    test('saves cache if it does not exist', async () => {
      when(cacheManagerMock.restoreCache(anything(), anything()));

      initialCache.downloadUrls = {};

      const buildStep = cacheSaveBuildFunction.createBuildStepFromFunctionCall(ctx, {
        callInputs: { key, paths },
      });

      await buildStep.executeAsync();

      verify(cacheManagerMock.saveCache(anything(), anything())).once();

      const [, cache] = capture(cacheManagerMock.saveCache).first();
      expect(cache?.key).toMatch(/^\w+-value/);
      expect(cache?.paths).toStrictEqual(paths);
    });

    test("doesn't save cache if it exists", async () => {
      when(cacheManagerMock.restoreCache(anything(), anything()));

      initialCache.downloadUrls = { [existingKey]: 'url' };

      const buildStep = cacheSaveBuildFunction.createBuildStepFromFunctionCall(ctx, {
        callInputs: { key, paths },
      });

      await buildStep.executeAsync();

      verify(cacheManagerMock.saveCache(anything(), anything())).never();
    });
  });
});
