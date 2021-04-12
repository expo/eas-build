import chalk from 'chalk';

import { parseInputAsync } from './parseInput';
import { buildAsync } from './build';
import { listenForInterrupts, shouldExit } from './exit';

listenForInterrupts();

async function main(): Promise<void> {
  try {
    const { job } = await parseInputAsync();
    await buildAsync(job);
  } catch (err) {
    if (!shouldExit()) {
      console.error(chalk.red(err.message));
      process.exit(1);
    }
  }
}

void main();
