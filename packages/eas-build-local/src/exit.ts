import logger from './logger';

const handlers: (() => void | Promise<void>)[] = [];
let shouldExitStatus = false;

export function listenForInterrupts(): void {
  const handleExit = async (): Promise<void> => {
    logger.error({ phase: 'ABORT' }, 'Received termination signal.');
    shouldExitStatus = true;
    await Promise.allSettled(
      handlers.map((handler) => {
        return handler();
      })
    );
    process.exit(1);
  };

  process.on('SIGTERM', handleExit);
  process.on('SIGINT', handleExit);
}

export function registerHandler(fn: () => void | Promise<void>): void {
  handlers.push(fn);
}

export function shouldExit(): boolean {
  return shouldExitStatus;
}
