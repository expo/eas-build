import { IOType } from 'child_process';

import { pipeSpawnOutput, bunyan, PipeOptions } from '@expo/logger';
import spawnAsyncOriginal, {
  SpawnResult,
  SpawnPromise,
  SpawnOptions as SpawnOptionsOriginal,
} from '@expo/spawn-async';

import { nullthrows } from '../nullthrows.js';

interface IErrorClass {
  new (message?: string | undefined): Error;
}

type NoLogsTimeoutOptions = {
  warn?: {
    timeoutMinutes?: number;
    message?: string;
  };
  kill?: {
    timeoutMinutes?: number;
    message?: string;
    errorClass?: IErrorClass;
    errorMessage?: string;
  };
};

// We omit 'ignoreStdio' to simplify logic -- only 'stdio' governs stdio.
// We omit 'stdio' here to add further down in a logger-based union.
type SpawnOptions = Omit<SpawnOptionsOriginal, 'stdio' | 'ignoreStdio'> &
  PipeOptions &
  (
    | {
        // If logger is passed, we require stdio to be pipe.
        logger: bunyan;
        stdio: 'pipe' | [IOType, 'pipe', 'pipe', ...IOType[]];
        noLogsTimeout?: NoLogsTimeoutOptions;
      }
    | {
        // If logger is not passed, stdio can be anything.
        // Defaults to inherit.
        logger?: never;
        stdio?: SpawnOptionsOriginal['stdio'];
        noLogsTimeout?: undefined;
      }
  );

const SPAWN_WARN_TIMEOUT_DEFAULT_MINUTES = 15;
const SPAWN_WARN_TIMEOUT_DEFAULT_MESSAGE =
  'Command takes longer then expected and it did not produce any logs in the past ${minutes} minutes. Consider evaluating your command for possible issues.';
const SPAWN_KILL_TIMEOUT_DEFAULT_MINUTES = 30;
const SPAWN_KILL_TIMEOUT_DEFAULT_MESSAGE =
  'Command takes a very long time and it did not produce any logs in the past ${minutes} minutes. Most likely an unexpected error happened which caused the process to hang and it will be terminated.';
const SPAWN_KILL_TIMEOUT_DEFAULT_ERROR_MESSAGE =
  'Command was inactive for over ${minutes} minutes. Please evaluate if it is correct.';

function getWarnTimeoutMessage(noLogsTimeout: NoLogsTimeoutOptions): string {
  const warnTimeoutMinutes =
    noLogsTimeout.warn?.timeoutMinutes ?? SPAWN_WARN_TIMEOUT_DEFAULT_MINUTES;
  return (
    noLogsTimeout.warn?.message ??
    SPAWN_WARN_TIMEOUT_DEFAULT_MESSAGE.replace('${minutes}', warnTimeoutMinutes.toString())
  );
}

function getKillTimeoutMessage(noLogsTimeout: NoLogsTimeoutOptions): string {
  const killTimeoutMinutes =
    noLogsTimeout.kill?.timeoutMinutes ?? SPAWN_KILL_TIMEOUT_DEFAULT_MINUTES;
  return (
    noLogsTimeout.kill?.message ??
    SPAWN_KILL_TIMEOUT_DEFAULT_MESSAGE.replace('${minutes}', killTimeoutMinutes.toString())
  );
}

function getKillTimeoutError(noLogsTimeout: NoLogsTimeoutOptions | undefined): Error {
  const spawnKillTimeout =
    noLogsTimeout?.kill?.timeoutMinutes ?? SPAWN_KILL_TIMEOUT_DEFAULT_MINUTES;
  const errorMessage =
    noLogsTimeout?.kill?.errorMessage ??
    SPAWN_KILL_TIMEOUT_DEFAULT_ERROR_MESSAGE.replace('${minutes}', spawnKillTimeout.toString());
  const ErrorClass = noLogsTimeout?.kill?.errorClass ?? Error;
  return new ErrorClass(errorMessage);
}

// eslint-disable-next-line async-protect/async-suffix
export function spawnAsync(
  command: string,
  args: string[],
  allOptions: SpawnOptions = {
    stdio: 'inherit',
    cwd: process.cwd(),
  }
): SpawnPromise<SpawnResult> {
  const { logger, noLogsTimeout, ...options } = allOptions;
  let spawnWarnTimeout: NodeJS.Timeout | undefined;
  let spawnKillTimeout: NodeJS.Timeout | undefined;
  let spawnTimedOut: boolean = false;

  function setCommandSpawnTimeouts(
    noLogsTimeout: NoLogsTimeoutOptions,
    logger: bunyan,
    spawnPromise: SpawnPromise<SpawnResult>
  ): void {
    if (noLogsTimeout.warn) {
      const warnTimeoutMinutes =
        noLogsTimeout.warn.timeoutMinutes ?? SPAWN_WARN_TIMEOUT_DEFAULT_MINUTES;
      spawnWarnTimeout = setTimeout(
        () => {
          logger.warn(getWarnTimeoutMessage(noLogsTimeout));
        },
        warnTimeoutMinutes * 60 * 1000
      );
    }

    if (noLogsTimeout.kill) {
      const killTimeoutMinutes =
        noLogsTimeout.kill.timeoutMinutes ?? SPAWN_KILL_TIMEOUT_DEFAULT_MINUTES;
      spawnKillTimeout = setTimeout(
        async () => {
          spawnTimedOut = true;
          logger.error(getKillTimeoutMessage(noLogsTimeout));
          const ppid = nullthrows(spawnPromise.child.pid);
          process.kill(ppid);
        },
        killTimeoutMinutes * 60 * 1000
      );
    }
  }

  const spawnPromise = spawnAsyncOriginal(command, args, options);
  if (logger && spawnPromise.child) {
    if (noLogsTimeout) {
      const optionsWithCallback = {
        ...options,
        infoCallbackFn: () => {
          if (spawnWarnTimeout) {
            spawnWarnTimeout.refresh();
          }
          if (spawnKillTimeout) {
            spawnKillTimeout.refresh();
          }
        },
      };
      pipeSpawnOutput(logger, spawnPromise.child, optionsWithCallback);
      setCommandSpawnTimeouts(noLogsTimeout, logger, spawnPromise);
    } else {
      pipeSpawnOutput(logger, spawnPromise.child, options);
    }
  }
  spawnPromise
    .catch((err: any) => {
      if (spawnTimedOut) {
        throw getKillTimeoutError(noLogsTimeout);
      }
      throw err;
    })
    .finally(() => {
      if (spawnWarnTimeout) {
        clearTimeout(spawnWarnTimeout);
      }
      if (spawnKillTimeout) {
        clearTimeout(spawnKillTimeout);
      }
    });

  return spawnPromise;
}
