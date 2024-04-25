import { createLogger } from '@expo/logger';
import { ManagedArtifactType } from '@expo/eas-build-job';

import { BuildContext } from '../context';

import { createTestIosJob } from './utils/job';

const mockLogger = createLogger({ name: 'mock-logger' });

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
  it('uploads artifact if fails first time and then succeeds', async () => {
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
          throw new Error('Upload failed once');
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
  it('uploads artifact if fails twice and then succeeds', async () => {
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
          throw new Error('Upload failed once');
        })
        .mockImplementationOnce(() => {
          throw new Error('Upload failed twice');
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
  it('does not upload artifact if fails three times', async () => {
    const job = createTestIosJob();
    const finalError = new Error('Upload failed thrice');
    const ctx = new BuildContext(job, {
      workingdir: '/workingdir',
      logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
      logger: mockLogger,
      env: {},
      runGlobalExpoCliCommand: jest.fn(),
      uploadArtifact: jest
        .fn()
        .mockImplementationOnce(() => {
          throw new Error('Upload failed once');
        })
        .mockImplementationOnce(() => {
          throw new Error('Upload failed twice');
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
    expect(ctx.uploadArtifact({ artifact, logger: mockLogger })).rejects.toThrow(finalError);
    expect(ctx.artifacts[artifact.type]).toBeUndefined();
  });
});
