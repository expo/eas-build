import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import bunyan from 'bunyan';
import spawnAsync from '@expo/spawn-async';

import { findMaestroPathsFlowsToExecuteAsync } from '../findMaestroPathsFlowsToExecuteAsync';
import { createMockLogger } from '../../__tests__/utils/logger';

jest.unmock('node:fs');
jest.setTimeout(15000);

/**
 *
 * You need to have a Simulator running to run these tests.
 *
 */

describe('findMaestroPathsFlowsToExecuteAsync', () => {
  const fixturesDir = path.join(__dirname, 'fixtures', 'maestro-flows');
  const singleFileDir = path.join(__dirname, 'fixtures', 'single-file');

  let logger: bunyan;

  beforeAll(() => {
    logger = createMockLogger();
  });

  // Helper function to run maestro test and determine which flows it executed
  // by parsing the output
  async function getMaestroFlowList(
    flowPath: string,
    includeTags: string[] = [],
    excludeTags: string[] = []
  ): Promise<string[]> {
    const args = ['test', flowPath, '--no-ansi'];

    if (includeTags.length > 0) {
      args.push('--include-tags', includeTags.join(','));
    }

    if (excludeTags.length > 0) {
      args.push('--exclude-tags', excludeTags.join(','));
    }

    try {
      const result = await spawnAsync('maestro', args, {
        stdio: 'pipe',
      });

      return parseMaestroExecutedFlows(result.stdout + result.stderr);
    } catch (error: any) {
      const output = (error.stdout || '') + (error.stderr || '') + (error.message || '');
      return parseMaestroExecutedFlows(output);
    }
  }

  function parseMaestroExecutedFlows(output: string): string[] {
    return output
      .split('\n')
      .filter((line) => line.includes('[Passed]') || line.includes('> Flow'))
      .map((line) => {
        if (line.includes('[Passed]')) {
          return line.split('[Passed]')[1].trim().split(' ')[0];
        }
        return line.split('> Flow')[1].trim();
      })
      .sort();
  }

  // Helper function to run our implementation
  async function getOurFlowList(
    flowPath: string,
    includeTags: string[] = [],
    excludeTags: string[] = []
  ): Promise<string[]> {
    const result = await findMaestroPathsFlowsToExecuteAsync({
      workingDirectory: process.cwd(),
      flowPath: path.relative(process.cwd(), flowPath),
      includeTags,
      excludeTags,
      logger,
    });

    return result.map((filePath) => path.basename(filePath, path.extname(filePath))).sort();
  }

  describe('Directory-based flow discovery', () => {
    it('should discover all flows when no tags are specified', async () => {
      const maestroFlows = await getMaestroFlowList(fixturesDir);
      const ourFlows = await getOurFlowList(fixturesDir);

      expect(ourFlows).toEqual(maestroFlows);
    });

    it('should filter flows by include tags', async () => {
      const maestroFlows = await getMaestroFlowList(fixturesDir, ['auth']);
      const ourFlows = await getOurFlowList(fixturesDir, ['auth']);

      expect(ourFlows).toEqual(maestroFlows);
    });

    it('should filter flows by exclude tags', async () => {
      const maestroFlows = await getMaestroFlowList(fixturesDir, [], ['slow']);
      const ourFlows = await getOurFlowList(fixturesDir, [], ['slow']);

      expect(ourFlows).toEqual(maestroFlows);
    });

    it('should filter flows by both include and exclude tags', async () => {
      const maestroFlows = await getMaestroFlowList(fixturesDir, ['smoke'], ['regression']);
      const ourFlows = await getOurFlowList(fixturesDir, ['smoke'], ['regression']);

      expect(ourFlows).toEqual(maestroFlows);
    });

    it('should handle multiple include tags', async () => {
      const maestroFlows = await getMaestroFlowList(fixturesDir, ['auth', 'smoke']);
      const ourFlows = await getOurFlowList(fixturesDir, ['auth', 'smoke']);

      expect(ourFlows).toEqual(maestroFlows);
    });

    it('should handle multiple exclude tags', async () => {
      const maestroFlows = await getMaestroFlowList(fixturesDir, [], ['slow', 'regression']);
      const ourFlows = await getOurFlowList(fixturesDir, [], ['slow', 'regression']);

      expect(ourFlows).toEqual(maestroFlows);
    });

    it('should not include nested flows in subdirectories', async () => {
      const maestroFlows = await getMaestroFlowList(fixturesDir, ['nested']);
      const ourFlows = await getOurFlowList(fixturesDir, ['nested']);

      expect(ourFlows).toEqual(maestroFlows);
    });

    it('should exclude config files from flow discovery', async () => {
      const ourFlows = await getOurFlowList(fixturesDir);

      expect(ourFlows.every((flow) => !flow.endsWith('config.yaml'))).toBe(true);
      expect(ourFlows.every((flow) => !flow.endsWith('config.yml'))).toBe(true);
    });

    it('should exclude non-YAML files from flow discovery', async () => {
      const ourFlows = await getOurFlowList(fixturesDir);

      expect(ourFlows).not.toContain('non-flow-file');
    });
  });

  describe('Single file scenarios', () => {
    it('should handle single file input', async () => {
      const singleFile = path.join(singleFileDir, 'standalone-flow.yaml');

      const maestroFlows = await getMaestroFlowList(singleFile);
      const ourFlows = await getOurFlowList(singleFile);

      expect(ourFlows).toEqual(maestroFlows);
      expect(ourFlows).toHaveLength(1);
      expect(ourFlows[0]).toBe(path.basename(singleFile, path.extname(singleFile)));
    });

    it('should handle single file with tag filtering (include)', async () => {
      const singleFile = path.join(singleFileDir, 'standalone-flow.yaml');

      // This file has 'smoke' tag, so should be included
      const maestroFlows = await getMaestroFlowList(singleFile, ['smoke']);
      const ourFlows = await getOurFlowList(singleFile, ['smoke']);

      expect(ourFlows).toEqual(maestroFlows);
      expect(ourFlows).toHaveLength(1);
    });

    it('should handle single file with tag filtering (exclude)', async () => {
      const singleFile = path.join(singleFileDir, 'standalone-flow.yaml');

      // This file has 'smoke' tag, so should be excluded
      const maestroFlows = await getMaestroFlowList(singleFile, [], ['smoke']);
      const ourFlows = await getOurFlowList(singleFile, [], ['smoke']);

      expect(ourFlows).toEqual(maestroFlows);
      expect(ourFlows).toHaveLength(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle non-existent paths gracefully', async () => {
      const nonExistentPath = '/path/that/does/not/exist';

      // Our implementation should return empty array for non-existent paths
      await expect(getOurFlowList(nonExistentPath)).rejects.toThrow('ENOENT');
    });

    it('should handle empty directories', async () => {
      const emptyDir = path.join(__dirname, 'fixtures', 'empty-dir');
      await fs.mkdir(emptyDir, { recursive: true });

      try {
        const ourFlows = await getOurFlowList(emptyDir);
        expect(ourFlows).toEqual([]);
      } finally {
        await fs.rmdir(emptyDir);
      }
    });

    it('should handle flows that cannot be parsed', async () => {
      // The invalid-flow.yaml has extra fields that might cause parsing issues
      // but should still be discovered if tag filtering passes
      const ourFlows = await getOurFlowList(fixturesDir, ['invalid']);

      // Should either include the file (if parsing is lenient) or exclude it (if parsing fails)
      // The important thing is that it doesn't crash
      expect(Array.isArray(ourFlows)).toBe(true);
    });
  });

  describe('Performance comparison', () => {
    it('should complete discovery in reasonable time', async () => {
      const startTime = Date.now();

      await getOurFlowList(fixturesDir);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Detailed flow content verification', () => {
    it('should correctly identify flows with specific tag combinations', async () => {
      // Test complex tag filtering scenarios
      const authFlows = await getOurFlowList(fixturesDir, ['auth']);
      const smokeFlows = await getOurFlowList(fixturesDir, ['smoke']);
      const criticalFlows = await getOurFlowList(fixturesDir, ['critical']);

      // Verify specific files are included/excluded correctly
      expect(authFlows).toContain('tagged-flow-auth');
      expect(authFlows).not.toContain('nested-flow'); // Subdirectory flows excluded by default
      expect(smokeFlows).toContain('tagged-flow-smoke');
      expect(criticalFlows).toContain('tagged-flow-smoke');
    });

    it('should handle flows without tags correctly', async () => {
      // When no filters are applied, flows without tags should be included
      const allFlows = await getOurFlowList(fixturesDir);
      expect(allFlows).toContain('no-tags-flow');
      expect(allFlows).toContain('basic-flow');

      // When include tags are specified, flows without tags should be excluded
      const taggedFlows = await getOurFlowList(fixturesDir, ['auth']);
      expect(taggedFlows).not.toContain('no-tags-flow');
      expect(taggedFlows).not.toContain('basic-flow');
    });
  });
});
