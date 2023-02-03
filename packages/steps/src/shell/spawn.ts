import { pipeSpawnOutput, bunyan, PipeMode } from '@expo/logger';
import spawnAsyncOriginal, {
  SpawnResult,
  SpawnPromise,
  SpawnOptions as SpawnOptionsOriginal,
} from '@expo/spawn-async';

type SpawnOptions = SpawnOptionsOriginal & {
  logger?: bunyan;
  lineTransformer?: (line: string) => string | null;
  mode?: PipeMode;
};

// eslint-disable-next-line async-protect/async-suffix
export function spawnAsync(
  command: string,
  args: string[],
  allOptions: SpawnOptions = {
    stdio: 'inherit',
    cwd: process.cwd(),
  }
): SpawnPromise<SpawnResult> {
  const { logger, ...options } = allOptions;
  if (logger) {
    options.stdio = 'pipe';
  }
  const promise = spawnAsyncOriginal(command, args, options);
  if (logger && promise.child) {
    pipeSpawnOutput(logger, promise.child, options);
  }
  return promise;
}
