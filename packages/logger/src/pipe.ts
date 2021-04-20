import { Readable } from 'stream';

import bunyan from '@expo/bunyan';

type LineLogger = (line: string) => void;
type LineTransformer = (line: string) => string | null;
interface SpawnOutput {
  stdout?: Readable | null;
  stderr?: Readable | null;
}

interface PipeOptions {
  printAsStdoutOnly?: boolean;
  lineTransformer?: LineTransformer;
}

function pipe(stream: Readable, loggerFn: LineLogger, lineTransformer?: LineTransformer): void {
  const multilineLogger = createMultilineLogger(loggerFn, lineTransformer);
  stream.on('data', multilineLogger);
}

function pipeSpawnOutput(
  logger: bunyan,
  { stdout, stderr }: SpawnOutput = {},
  { printAsStdoutOnly = false, lineTransformer }: PipeOptions = {}
): void {
  if (stdout) {
    const stdoutLogger = logger.child({ source: 'stdout' });
    pipe(
      stdout,
      (line) => {
        stdoutLogger.info(line);
      },
      lineTransformer
    );
  }
  if (stderr) {
    const stderrLogger = logger.child({ source: printAsStdoutOnly ? 'stdout' : 'stderr' });
    pipe(
      stderr,
      (line) => {
        stderrLogger.info(line);
      },
      lineTransformer
    );
  }
}

function createMultilineLogger(loggerFn: LineLogger, transformer?: LineTransformer) {
  return (data: any): void => {
    if (!data) {
      return;
    }
    const lines = String(data).trim().split('\n');
    lines.forEach((line) => {
      if (transformer) {
        const transformedLine = transformer(line);
        if (transformedLine) {
          loggerFn(transformedLine);
        }
      } else {
        loggerFn(line);
      }
    });
  };
}

export { pipe, pipeSpawnOutput };
