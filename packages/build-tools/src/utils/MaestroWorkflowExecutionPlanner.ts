import { bunyan } from '@expo/logger';
import { asyncResult } from '@expo/results';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';
import { z } from 'zod';

const WorkspaceConfigSchema = z.object({
  flows: z.array(z.string()).optional(),
  includeTags: z.array(z.string()).optional(),
  excludeTags: z.array(z.string()).optional(),
  executionOrder: z
    .object({
      flowsOrder: z.array(z.string()).optional(),
      continueOnFailure: z.boolean().optional(),
    })
    .optional(),
});

const FlowConfigSchema = z.object({
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;
type FlowConfig = z.infer<typeof FlowConfigSchema>;

export async function findMaestroFlowsToExecuteAsync({
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
  if (!stat) {
    return [];
  }

  if (stat.isFile()) {
    return [absoluteFlowPath];
  }

  // It's a directory - discover flow files
  const allFlowFiles = await discoverFlowFilesAsync(absoluteFlowPath);
  if (allFlowFiles.length === 0) {
    return [];
  }

  // Find and parse workspace config
  const workspaceConfigResult = await asyncResult(
    findAndParseWorkspaceConfigAsync(absoluteFlowPath)
  );
  let workspaceConfig: WorkspaceConfig;
  if (!workspaceConfigResult.ok) {
    logger.warn(
      { error: workspaceConfigResult.reason },
      'Failed to find and parse workspace config'
    );
    workspaceConfig = {};
  } else {
    workspaceConfig = workspaceConfigResult.value ?? {};
  }

  // Apply workspace flow patterns (globs)
  const filteredByPatterns = await applyFlowPatterns({
    flowFiles: allFlowFiles,
    workspaceConfig,
    basePath: absoluteFlowPath,
  });
  if (filteredByPatterns.length === 0) {
    return [];
  }

  // Parse flow configs and apply tag filtering
  const flowConfigs = await parseFlowConfigs(filteredByPatterns);
  const allIncludeTags = [...includeTags, ...(workspaceConfig.includeTags ?? [])];
  const allExcludeTags = [...excludeTags, ...(workspaceConfig.excludeTags ?? [])];

  const filteredByTags = filteredByPatterns.filter((flowFile) => {
    const config = flowConfigs.get(flowFile);
    const tags = config?.tags ?? [];
    return matchesTags({
      flowTags: tags,
      includeTags: allIncludeTags,
      excludeTags: allExcludeTags,
    });
  });

  if (filteredByTags.length === 0) {
    return [];
  }

  // Handle execution sequences
  return applyExecutionOrder({
    flowFiles: filteredByTags,
    flowConfigs,
    workspaceConfig,
  });
}

async function discoverFlowFilesAsync(dirPath: string): Promise<string[]> {
  const flowFiles: string[] = [];

  async function walkDir(currentPath: string): Promise<void> {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        await walkDir(fullPath);
      } else if (entry.isFile() && isFlowFile(fullPath)) {
        flowFiles.push(fullPath);
      }
    }
  }

  await walkDir(dirPath);
  return flowFiles;
}

function isFlowFile(filePath: string): boolean {
  const ext = path.extname(filePath);
  if (ext !== '.yaml' && ext !== '.yml') {
    return false;
  }

  const basename = path.basename(filePath, ext);
  if (basename === 'config') {
    return false;
  }

  return true;
}

async function findAndParseWorkspaceConfigAsync(dirPath: string): Promise<WorkspaceConfig | null> {
  const configResults = await Promise.allSettled(
    [path.join(dirPath, 'config.yaml'), path.join(dirPath, 'config.yml')].map(
      async (configPath) => {
        let content;
        try {
          content = await fs.readFile(configPath, 'utf-8');
        } catch {
          return null;
        }
        return WorkspaceConfigSchema.parse(parseYaml(content));
      }
    )
  );

  const resolvedConfig = configResults.find(
    (result): result is PromiseFulfilledResult<WorkspaceConfig> =>
      result.status === 'fulfilled' && result.value !== null
  );

  return resolvedConfig?.value ?? null;
}

async function applyFlowPatterns({
  flowFiles,
  workspaceConfig,
  basePath,
}: {
  flowFiles: string[];
  workspaceConfig: WorkspaceConfig;
  basePath: string;
}): Promise<string[]> {
  // TODO(sjchmiela): verify
  const patterns = workspaceConfig.flows ?? ['*'];

  if (patterns.includes('*')) {
    // Default pattern - include all flows in top-level directory only
    return flowFiles.filter((file) => {
      const relativePath = path.relative(basePath, file);
      return !relativePath.includes(path.sep); // No subdirectories
    });
  }

  // Apply glob patterns (simplified implementation)
  const matchedFiles: string[] = [];

  for (const file of flowFiles) {
    const relativePath = path.relative(basePath, file);

    for (const pattern of patterns) {
      // Simple glob matching - convert * to .* for regex
      const regexPattern = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');

      const regex = new RegExp(`^${regexPattern}$`);
      const matchesPattern = regex.test(relativePath);
      if (matchesPattern) {
        matchedFiles.push(file);
        break;
      }
    }
  }

  return matchedFiles;
}

async function parseFlowConfigs(flowFiles: string[]): Promise<Map<string, FlowConfig>> {
  const configs = new Map<string, FlowConfig>();

  await Promise.all(
    flowFiles.map(async (file) => {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const config = parseFlowConfig(content);
        configs.set(file, config);
      } catch {
        // If we can't parse the flow, set empty config
        configs.set(file, {});
      }
    })
  );

  return configs;
}

function parseFlowConfig(yamlContent: string): FlowConfig {
  try {
    // Split on --- to get config section (before first ---)
    const parts = yamlContent.split(/^---\s*$/m);
    const configSection = parts[0].trim();

    if (!configSection) {
      return {};
    }

    const parsed = parseYaml(configSection);
    const result = FlowConfigSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    return {};
  } catch {
    return {};
  }
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

function applyExecutionOrder({
  flowFiles,
  flowConfigs,
  workspaceConfig,
}: {
  flowFiles: string[];
  flowConfigs: Map<string, FlowConfig>;
  workspaceConfig: WorkspaceConfig;
}): string[] {
  const executionOrder = workspaceConfig.executionOrder?.flowsOrder;

  if (!executionOrder || executionOrder.length === 0) {
    // No execution order specified, return files as-is
    return flowFiles;
  }

  // Create a map of flow name to file path
  const flowsByName = new Map<string, string>();
  for (const file of flowFiles) {
    const config = flowConfigs.get(file);
    const name = config?.name ?? path.basename(file, path.extname(file));
    flowsByName.set(name, file);
  }

  // Build ordered list based on execution order
  const orderedFlows: string[] = [];
  const usedFiles = new Set<string>();

  // First, add flows in the specified order
  for (const flowName of executionOrder) {
    const file = flowsByName.get(flowName);
    if (file && flowFiles.includes(file)) {
      orderedFlows.push(file);
      usedFiles.add(file);
    }
  }

  // Then add any remaining flows that weren't in the execution order
  for (const file of flowFiles) {
    if (!usedFiles.has(file)) {
      orderedFlows.push(file);
    }
  }

  return orderedFlows;
}
