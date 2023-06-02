import bunyan from 'bunyan';
import { v1 } from 'uuid';

import LoggerLevel from './level';
import { pipe, pipeSpawnOutput, PipeMode } from './pipe';

const DEFAULT_LOGGER_NAME = 'expo-logger';

interface BunyanLogger extends bunyan {
  _emit: (rec: any, noEmit: boolean) => string;
}

function createLogger(options: bunyan.LoggerOptions): bunyan {
  const logger = bunyan.createLogger({
    serializers: bunyan.stdSerializers,
    ...options,
  }) as BunyanLogger;

  const originalEmit = logger._emit.bind(logger);
  logger._emit = (rec, noEmit) => {
    rec.id = v1();
    return originalEmit(rec, noEmit);
  };

  return logger;
}

const defaultLogger = createLogger({
  name: DEFAULT_LOGGER_NAME,
  level: LoggerLevel.INFO,
});

export default defaultLogger;
export { LoggerLevel, createLogger, pipe, pipeSpawnOutput, PipeMode };
export type { bunyan };
