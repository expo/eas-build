import assert from 'assert';
import path from 'path';

import { bunyan } from '@expo/logger';
import { ExpoRunFormatter } from '@expo/xcpretty';
import spawnAsync, { SpawnPromise, SpawnResult } from '@expo/spawn-async';
import fg from 'fast-glob';

const CHECK_FILE_INTERVAL_MS = 1000;


export class XcodeBuildLogger {
  private loggerError?: Error;
  private flushing: boolean = false;
  private logReaderPromise?: SpawnPromise<SpawnResult>;

  constructor(private readonly logger: bunyan, private readonly projectRoot: string) {}

  public async watchLogFiles(logsDirectory: string): Promise<void> {
    while (!this.flushing) {
      const logsFilename = await this.getBuildLogFilename(logsDirectory);
      if (logsFilename) {
        void this.startBuildLogger(path.join(logsDirectory, logsFilename));
        return;
      }
      await new Promise((res) => setTimeout(res, CHECK_FILE_INTERVAL_MS));
    }
  }

  public async flush(): Promise<void> {
    this.flushing = true;
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
    return paths.length >= 1 ? paths[0] : undefined;
  }

  private async startBuildLogger(logsPath: string): Promise<void> {
    try {
      const formatter = ExpoRunFormatter.create(this.projectRoot, { 
        isDebug: false  
        // TODO: Can provide xcode project name for better parsing
      });
      this.logReaderPromise = spawnAsync('tail', ['-n', '+0', '-f', logsPath], { stdio: 'pipe' });
      assert(this.logReaderPromise.child.stdout, 'stdout is not available');
      this.logReaderPromise.child.stdout.on('data', (data: string) => {
        const lines = formatter.pipe(data.toString());
        for (const line of lines) {
          this.logger.info(line);
        }
      });
      await this.logReaderPromise;

      this.logger.info(formatter.getBuildSummary());
    } catch (err) {
      if (!this.flushing) {
        this.loggerError = err;
      }
    }
  }
}
