import assert from 'assert';
import path from 'path';

import { bunyan } from '@expo/logger';
import { Formatter } from '@expo/xcpretty';
import spawnAsync, { SpawnPromise, SpawnResult } from '@expo/spawn-async';
import fg from 'fast-glob';

class CustomFormatter extends Formatter {
  public shouldShowCompileWarning(
    filePath: string,
    _lineNumber?: string,
    _columnNumber?: string
  ): boolean {
    return !filePath.match(/node_modules/) && !filePath.match(/\/ios\/Pods\//);
  }
}

export class XcodeBuildLogger {
  private checkFilesInterval?: NodeJS.Timeout;
  private loggerError?: Error;
  private flushing: boolean = false;
  private logReaderPromise?: SpawnPromise<SpawnResult>;

  constructor(private readonly logger: bunyan, private readonly projectRoot: string) {}

  public watchLogFiles(logsDirectory: string): void {
    this.checkFilesInterval = setInterval(async () => {
      const logsFilename = await this.getBuildLogFilename(logsDirectory);
      if (logsFilename) {
        void this.startBuildLogger(path.join(logsDirectory, logsFilename));
        if (this.checkFilesInterval) {
          clearInterval(this.checkFilesInterval);
          this.checkFilesInterval = undefined;
        }
      }
    }, 1000);
  }

  public async flush(): Promise<void> {
    this.flushing = true;
    if (this.checkFilesInterval) {
      clearInterval(this.checkFilesInterval);
      this.checkFilesInterval = undefined;
    }
    if (this.loggerError) {
      throw this.loggerError;
    }
    if (this.logReaderPromise) {
      this.logReaderPromise.child.kill('SIGINT');
      try {
        await this.logReaderPromise;
      } catch {}
    }
  }
  private async getBuildLogFilename(logsDirectory: string): Promise<string | undefined> {
    const paths = await fg('*.log', { cwd: logsDirectory });
    if (paths.length >= 1) {
      return paths[0];
    }
    return undefined;
  }

  private async startBuildLogger(logsPath: string): Promise<void> {
    try {
      const formatter = new CustomFormatter({ projectRoot: this.projectRoot });
      this.logReaderPromise = spawnAsync('tail', ['-n', '+0', '-f', logsPath], { stdio: 'pipe' });
      assert(this.logReaderPromise.child.stdout, 'stdout is not available');
      this.logReaderPromise.child.stdout.on('data', (data: string) => {
        const lines = formatter.pipe(data.toString());
        for (const line of lines) {
          this.logger.info(line);
        }
      });
      await this.logReaderPromise;
    } catch (err) {
      if (!this.flushing) {
        this.loggerError = err;
      }
    }
  }
}
