import { createLogger } from '@expo/logger';
import { ManagedArtifactType } from '@expo/eas-build-job';

import { BuildContext } from '../context';

import { createTestIosJob } from './utils/job';

const mockLogger = createLogger({ name: 'mock-logger' });

class DNSError extends Error {
  private readonly _code: string = 'ENOTFOUND';

  constructor(message: string, code?: string) {
    super(message);
    this._code = code ?? this._code;
  }

  public get code(): string {
    return this._code;
  }
}

describe('uploadArtifact', () => {
  it('uploads artifact if successful first time', async () => {
    const job = createTestIosJob();
    const ctx = new BuildContext(job, {
      workingdir: '/workingdir',
      logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
      logger: mockLogger,
      env: {},
      runGlobalExpoCliCommand: jest.fn(),
      uploadArtifact: jest.fn().mockImplementation(() => Promise.resolve('bucketKey')),
    });
    (ctx as any).ARTIFACT_UPLOAD_RETRY_INTERVAL_MS = 500; // reduced for testing, normally 30s
    const artifact = {
      type: ManagedArtifactType.APPLICATION_ARCHIVE,
      paths: [],
    };

    await ctx.uploadArtifact({ artifact, logger: mockLogger });

    expect(ctx.artifacts[artifact.type]).toEqual('bucketKey');
  });

  it('uploads artifact if fails first time with DNS error and then succeeds', async () => {
    const job = createTestIosJob();
    const ctx = new BuildContext(job, {
      workingdir: '/workingdir',
      logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
      logger: mockLogger,
      env: {},
      runGlobalExpoCliCommand: jest.fn(),
      uploadArtifact: jest
        .fn()
        .mockImplementationOnce(() => {
          throw new DNSError('Upload failed once');
        })
        .mockImplementation(() => Promise.resolve('bucketKey')),
    });
    (ctx as any).ARTIFACT_UPLOAD_RETRY_INTERVAL_MS = 500; // reduced for testing, normally 30s
    const artifact = {
      type: ManagedArtifactType.APPLICATION_ARCHIVE,
      paths: [],
    };

    await ctx.uploadArtifact({ artifact, logger: mockLogger });

    expect(ctx.artifacts[artifact.type]).toEqual('bucketKey');
  });

  it('uploads artifact if fails twice with DNS error and then succeeds', async () => {
    const job = createTestIosJob();
    const ctx = new BuildContext(job, {
      workingdir: '/workingdir',
      logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
      logger: mockLogger,
      env: {},
      runGlobalExpoCliCommand: jest.fn(),
      uploadArtifact: jest
        .fn()
        .mockImplementationOnce(() => {
          throw new DNSError('Upload failed once');
        })
        .mockImplementationOnce(() => {
          throw new DNSError('Upload failed twice', 'EAI_AGAIN');
        })
        .mockImplementation(() => Promise.resolve('bucketKey')),
    });
    (ctx as any).ARTIFACT_UPLOAD_RETRY_INTERVAL_MS = 500; // reduced for testing, normally 30s
    const artifact = {
      type: ManagedArtifactType.APPLICATION_ARCHIVE,
      paths: [],
    };

    await ctx.uploadArtifact({ artifact, logger: mockLogger });

    expect(ctx.artifacts[artifact.type]).toEqual('bucketKey');
  });

  it('does not upload artifact if fails three times with DNS error', async () => {
    const job = createTestIosJob();
    const finalError = new DNSError('Upload failed thrice');
    const ctx = new BuildContext(job, {
      workingdir: '/workingdir',
      logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
      logger: mockLogger,
      env: {},
      runGlobalExpoCliCommand: jest.fn(),
      uploadArtifact: jest
        .fn()
        .mockImplementationOnce(() => {
          throw new DNSError('Upload failed once');
        })
        .mockImplementationOnce(() => {
          throw new DNSError('Upload failed twice');
        })
        .mockImplementationOnce(() => {
          throw finalError;
        })
        .mockImplementation(() => Promise.resolve('bucketKey')),
    });
    (ctx as any).ARTIFACT_UPLOAD_RETRY_INTERVAL_MS = 500; // reduced for testing, normally 30s
    const artifact = {
      type: ManagedArtifactType.APPLICATION_ARCHIVE,
      paths: [],
    };

    await expect(ctx.uploadArtifact({ artifact, logger: mockLogger })).rejects.toThrow(finalError);

    expect(ctx.artifacts[artifact.type]).toBeUndefined();
  });

  it('does not upload artifact if fails once with an error different than DNS error', async () => {
    const job = createTestIosJob();
    const firstError = new Error('Upload failed with a different kind of error');
    const ctx = new BuildContext(job, {
      workingdir: '/workingdir',
      logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
      logger: mockLogger,
      env: {},
      runGlobalExpoCliCommand: jest.fn(),
      uploadArtifact: jest
        .fn()
        .mockImplementationOnce(() => {
          throw firstError;
        })
        .mockImplementation(() => Promise.resolve('bucketKey')),
    });
    (ctx as any).ARTIFACT_UPLOAD_RETRY_INTERVAL_MS = 500; // reduced for testing, normally 30s
    const artifact = {
      type: ManagedArtifactType.APPLICATION_ARCHIVE,
      paths: [],
    };

    await expect(ctx.uploadArtifact({ artifact, logger: mockLogger })).rejects.toThrow(firstError);

    expect(ctx.artifacts[artifact.type]).toBeUndefined();
  });
});
