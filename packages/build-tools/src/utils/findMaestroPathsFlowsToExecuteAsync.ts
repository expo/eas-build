import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { bunyan } from '@expo/logger';
import * as yaml from 'yaml';
import { z } from 'zod';
import { asyncResult } from '@expo/results';

const FlowConfigSchema = z.object({
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type FlowConfig = z.infer<typeof FlowConfigSchema>;

export async function findMaestroPathsFlowsToExecuteAsync({
  workingDirectory,
  flowPath,
  includeTags,
  excludeTags,
  logger,
}: {
  workingDirectory: string;
  flowPath: string;
  includeTags: string[] | undefined;
  excludeTags: string[] | undefined;
  logger: bunyan;
}): Promise<string[]> {
  const absoluteFlowPath = path.resolve(workingDirectory, flowPath);
  // If it's a file, just return it (no validation needed)
  const stat = await fs.stat(absoluteFlowPath);

  if (stat.isFile()) {
    logger.info(`Found a file: ${path.relative(workingDirectory, absoluteFlowPath)}`);
    return [absoluteFlowPath];
  }

  // It's a directory - discover flow files
  logger.info(`Found a directory: ${path.relative(workingDirectory, absoluteFlowPath)}`);
  logger.info(`Searching for flow files...`);
  const { flows } = await findAndParseFlowFilesAsync({
    dirPath: absoluteFlowPath,
    workingDirectory,
    logger,
  });

  if (flows.length === 0) {
    logger.info(
      `No valid flow files found in: ${path.relative(workingDirectory, absoluteFlowPath)}`
    );
    return [];
  }

  if (!includeTags && !excludeTags) {
    logger.info(`No tags provided, returning all flows.`);
    return flows.map(({ path }) => path);
  }

  logger.info(
    `Filtering flows by tags. Tags to include: ${JSON.stringify(includeTags)}. Tags to exclude: ${JSON.stringify(excludeTags) ?? 'none'}.`
  );
  return flows
    .filter(({ config, path: flowPath }) => {
      const shouldInclude = matchesTags({
        flowTags: config?.tags ?? [],
        includeTags: includeTags ?? [],
        excludeTags: excludeTags ?? [],
      });

      logger.info(
        shouldInclude
          ? `- ${path.relative(workingDirectory, flowPath)} matches tags, including.`
          : `- ${path.relative(workingDirectory, flowPath)} does not match tags, excluding.`
      );

      return shouldInclude;
    })
    .map(({ path }) => path);
}

async function findAndParseFlowFilesAsync({
  workingDirectory,
  dirPath,
  logger,
}: {
  workingDirectory: string;
  dirPath: string;
  logger: bunyan;
}): Promise<{ flows: { config: FlowConfig; path: string }[] }> {
  const flows: { config: FlowConfig; path: string }[] = [];

  const entries = await fs.readdir(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isFile()) {
      // Skip non-YAML files
      const ext = path.extname(fullPath);
      if (ext !== '.yaml' && ext !== '.yml') {
        logger.info(`Skipping non-YAML file: ${path.relative(workingDirectory, fullPath)}`);
        continue;
      }

      // Skip Maestro config files
      const basename = path.basename(fullPath, ext);
      if (basename === 'config') {
        logger.info(
          `Maestro config files are not supported yet. Skipping Maestro config file: ${path.relative(workingDirectory, fullPath)}`
        );
        continue;
      }

      const result = await asyncResult(parseFlowFile(fullPath));
      if (result.ok) {
        logger.info(`Found flow file: ${path.relative(workingDirectory, fullPath)}`);
        flows.push({ config: result.value, path: fullPath });
      } else {
        logger.info(
          { err: result.reason },
          `Skipping flow file: ${path.relative(workingDirectory, fullPath)}`
        );
      }
    } else if (entry.isDirectory()) {
      logger.info(
        `Default behavior excludes subdirectories. Skipping subdirectory: ${path.relative(workingDirectory, fullPath)}`
      );
    }
  }

  return { flows };
}

async function parseFlowFile(filePath: string): Promise<FlowConfig> {
  const content = await fs.readFile(filePath, 'utf-8');
  const documents = yaml.parseAllDocuments(content);
  const configDoc = documents[0];
  if (!configDoc) {
    throw new Error(`No config section found in ${filePath}`);
  }
  return FlowConfigSchema.parse(configDoc.toJS());
}

function matchesTags({
  flowTags,
  includeTags,
  excludeTags,
}: {
  flowTags: string[];
  includeTags: string[];
  excludeTags: string[];
}): boolean {
  // Include logic: if includeTags is empty OR flow has any of the include tags
  const includeMatch =
    includeTags.length === 0 || includeTags.some((tag) => flowTags.includes(tag));

  // Exclude logic: if excludeTags is empty OR flow has none of the exclude tags
  const excludeMatch =
    excludeTags.length === 0 || !excludeTags.some((tag) => flowTags.includes(tag));

  return includeMatch && excludeMatch;
}
