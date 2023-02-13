import { BuildConfigError } from './BuildConfigError.js';
import { UserError } from './UserError.js';

export class BuildWorkflowError extends UserError {
  constructor(
    public override readonly message: string,
    public readonly errors: BuildConfigError[],
    extra?: {
      metadata?: object;
      cause?: Error;
    }
  ) {
    super(message, extra);
  }
}
