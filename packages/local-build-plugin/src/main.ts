import chalk from 'chalk';

import { parseInputAsync } from './parseInput';
import { buildAsync } from './build';
import { listenForInterrupts, shouldExit } from './exit';
import { checkRuntimeAsync } from './checkRuntime';

listenForInterrupts();

async function main(): Promise<void> {
  try {
    const { job } = await parseInputAsync();
    await checkRuntimeAsync(job);
    await buildAsync(job);
  } catch (err: any) {
    if (!shouldExit()) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  }
}

void main();
