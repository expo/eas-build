export abstract class UserError extends Error {
  public readonly cause?: Error;
  public readonly metadata: object;

  constructor(
    public override readonly message: string,
    extra?: {
      metadata?: object;
      cause?: Error;
    }
  ) {
    super(message);
    this.metadata = extra?.cause ?? {};
    this.cause = extra?.cause;
  }
}
