import { bunyan } from '@expo/logger';

export class BuildStepContext {
  constructor(
    public readonly buildId: string,
    public readonly logger: bunyan,
    public readonly skipCleanup: boolean
  ) {}
}
