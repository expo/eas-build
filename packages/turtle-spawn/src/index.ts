import { pipeSpawnOutput, bunyan } from '@expo/logger';
import spawnAsync, { SpawnResult, SpawnOptions as SpawnAsyncOptions } from '@expo/spawn-async';

type SpawnOptions = SpawnAsyncOptions & {
  logger?: bunyan;
  lineTransformer?: (line: string) => string | null;
  printAsStdoutOnly?: boolean;
};

async function spawn(
  command: string,
  args: string[],
  _options: SpawnOptions = {
    stdio: 'inherit',
    cwd: process.cwd(),
  }
): Promise<SpawnResult> {
  const options = { ..._options };
  const { logger } = options;
  if (logger) {
    options.stdio = 'pipe';
  }
  const promise = spawnAsync(command, args, options);
  if (logger && promise.child) {
    pipeSpawnOutput(logger, promise.child, options);
  }
  return await promise;
}

export default spawn;
export { SpawnOptions, SpawnResult };
