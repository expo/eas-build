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
  absoluteFlowPath,
  includeTags = [],
  excludeTags = [],
  logger,
}: {
  absoluteFlowPath: string;
  includeTags?: string[];
  excludeTags?: string[];
  logger: bunyan;
}): Promise<string[]> {
  // If it's a file, just return it (no validation needed)
  const stat = await fs.stat(absoluteFlowPath);

  if (stat.isFile()) {
    logger.info(`"${absoluteFlowPath}" is a file.`);
    return [absoluteFlowPath];
  }

  // It's a directory - discover flow files
  logger.info(`"${absoluteFlowPath}" is a directory.`);
  const { flows } = await findAndParseFlowFilesAsync({
    dirPath: absoluteFlowPath,
    logger,
  });

  if (flows.length === 0) {
    logger.info(`No valid flow files found in "${absoluteFlowPath}".`);
    return [];
  }

  if (!includeTags && !excludeTags) {
    logger.info(`No tags provided, returning all flows.`);
    return flows.map(({ path }) => path);
  }

  logger.info(
    `Filtering flows by tags. Tags to include: ${includeTags.map((tag) => JSON.stringify(tag)).join(', ')}. Tags to exclude: ${excludeTags.map((tag) => JSON.stringify(tag)).join(', ')}.`
  );
  const filteredByTags = flows.filter(({ config }) => {
    const tags = config?.tags ?? [];
    const shouldInclude = matchesTags({
      flowTags: tags,
      includeTags,
      excludeTags,
    });

    logger.info(
      shouldInclude
        ? `"${path}" matches tags, including.`
        : `"${path}" does not match tags, excluding.`
    );

    return shouldInclude;
  });

  return filteredByTags.map(({ path }) => path);
}

async function findAndParseFlowFilesAsync({
  dirPath,
  logger,
}: {
  dirPath: string;
  logger: bunyan;
}): Promise<{ flows: { config: FlowConfig; path: string }[] }> {
  const flows: { config: FlowConfig; path: string }[] = [];

  const directoriesToSearch = [dirPath];
  while (directoriesToSearch.length > 0) {
    const currentPath = directoriesToSearch.shift();
    if (!currentPath) {
      continue;
    }
    logger.info(`Searching for flow files in "${currentPath}"...`);

    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        logger.info(`Found directory "${fullPath}", queueing for search.`);
        directoriesToSearch.push(fullPath);
      } else if (entry.isFile()) {
        // Skip non-YAML files
        const ext = path.extname(fullPath);
        if (ext !== '.yaml' && ext !== '.yml') {
          logger.info(`Skipping non-YAML file "${fullPath}".`);
          continue;
        }

        // Skip Maestro config files
        const basename = path.basename(fullPath, ext);
        if (basename === 'config') {
          logger.info(
            `Skipping Maestro config file "${fullPath}". Maestro config files are not supported yet.`
          );
          continue;
        }

        const result = await asyncResult(parseFlowFile(fullPath));
        if (result.ok) {
          logger.info(`Found flow file "${fullPath}".`);
          flows.unshift({ config: result.value, path: fullPath });
        } else {
          logger.info({ err: result.reason }, `Skipping flow file "${fullPath}" due to error.`);
        }
      }
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
