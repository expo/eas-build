import { ExpoConfig } from '@expo/config';
import { Android } from '@expo/eas-build-job';
import { spawnAsync } from '@expo/steps';
import { instance, mock, when } from 'ts-mockito';

import { BuildContext } from '../../context';
import { PackageManager } from '../packageManager';
import { runExpoCliCommand } from '../project';

jest.mock('@expo/steps', () => {
  const spawnAsync = jest.fn();
  return {
    ...jest.requireActual('@expo/steps'),
    spawnAsync,
    __esModule: true,
  };
});

describe(runExpoCliCommand, () => {
  describe('Expo SDK >= 46', () => {
    it('spawns expo via "npx" when package manager is npm', () => {
      const mockExpoConfig = mock<ExpoConfig>();
      when(mockExpoConfig.sdkVersion).thenReturn('46.0.0');
      const expoConfig = instance(mockExpoConfig);

      const mockCtx = mock<BuildContext<Android.Job>>();
      when(mockCtx.packageManager).thenReturn(PackageManager.NPM);
      when(mockCtx.appConfig).thenReturn(expoConfig);
      const ctx = instance(mockCtx);

      void runExpoCliCommand(ctx, ['doctor'], {});
      expect(spawnAsync).toHaveBeenCalledWith('npx', ['expo', 'doctor'], expect.any(Object));
    });

    it('spawns expo via "yarn" when package manager is yarn', () => {
      const mockExpoConfig = mock<ExpoConfig>();
      when(mockExpoConfig.sdkVersion).thenReturn('46.0.0');
      const expoConfig = instance(mockExpoConfig);

      const mockCtx = mock<BuildContext<Android.Job>>();
      when(mockCtx.packageManager).thenReturn(PackageManager.NPM);
      when(mockCtx.appConfig).thenReturn(expoConfig);
      const ctx = instance(mockCtx);

      void runExpoCliCommand(ctx, ['doctor'], {});
      expect(spawnAsync).toHaveBeenCalledWith('npx', ['expo', 'doctor'], expect.any(Object));
    });

    it('spawns expo via "pnpm" when package manager is pnpm', () => {
      const mockExpoConfig = mock<ExpoConfig>();
      when(mockExpoConfig.sdkVersion).thenReturn('46.0.0');
      const expoConfig = instance(mockExpoConfig);

      const mockCtx = mock<BuildContext<Android.Job>>();
      when(mockCtx.packageManager).thenReturn(PackageManager.PNPM);
      when(mockCtx.appConfig).thenReturn(expoConfig);
      const ctx = instance(mockCtx);

      void runExpoCliCommand(ctx, ['doctor'], {});
      expect(spawnAsync).toHaveBeenCalledWith('pnpm', ['expo', 'doctor'], expect.any(Object));
    });

    it('spawns expo via "bun" when package manager is bun', () => {
      const mockExpoConfig = mock<ExpoConfig>();
      when(mockExpoConfig.sdkVersion).thenReturn('46.0.0');
      const expoConfig = instance(mockExpoConfig);

      const mockCtx = mock<BuildContext<Android.Job>>();
      when(mockCtx.packageManager).thenReturn(PackageManager.BUN);
      when(mockCtx.appConfig).thenReturn(expoConfig);
      const ctx = instance(mockCtx);

      void runExpoCliCommand(ctx, ['doctor'], {});
      expect(spawnAsync).toHaveBeenCalledWith('bun', ['expo', 'doctor'], expect.any(Object));
    });
  });
});
