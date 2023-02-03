import os from 'os';
import path from 'path';

import { bunyan } from '@expo/logger';

export class BuildStepContext {
  public readonly baseWorkingDirectory: string;
  public readonly workingDirectory: string;

  constructor(
    public readonly buildId: string,
    public readonly logger: bunyan,
    public readonly skipCleanup: boolean,
    workingDirectory?: string
  ) {
    this.baseWorkingDirectory = path.join(os.tmpdir(), 'eas-build', buildId);
    this.workingDirectory = workingDirectory ?? path.join(this.baseWorkingDirectory, 'project');
  }
}
