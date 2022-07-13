import { Job } from '@expo/eas-build-job';
import { anyOfClass, anything, instance, mock, verify, when } from 'ts-mockito';
import { v4 as uuidv4 } from 'uuid';

import { BuildContext } from '../../context';
import { createNpmErrorHandler } from '../handleNpmError';

describe(createNpmErrorHandler, () => {
  it('calls reportError when detected corrupted npm package', () => {
    const mockEnv = {
      EAS_BUILD_ID: uuidv4(),
    };

    const mockCtx = mock<BuildContext<Job>>();
    when(mockCtx.env).thenReturn(mockEnv);
    const ctx = instance(mockCtx);

    const npmErrorHandler = createNpmErrorHandler(ctx);
    const fakeError = new Error();
    npmErrorHandler(fakeError, [
      '[stderr] WARN tarball tarball data for @typescript-eslint/typescript-estree@5.26.0 (sha512-cozo/GbwixVR0sgfHItz3t1yXu521yn71Wj6PlYCFA3WPhy51CUPkifFKfBis91bDclGmAY45hhaAXVjdn4new==) seems to be corrupted. Trying again.',
    ]);
    verify(mockCtx.reportError?.('Corrupted npm package', anyOfClass(Error), anything())).called();
  });

  it('calls reportError when detected corrupted npm cache error', () => {
    const mockEnv = {
      EAS_BUILD_ID: uuidv4(),
      EAS_BUILD_NPM_CACHE_URL: 'https://dominik.sokal.pl/npm/cache',
    };

    const mockCtx = mock<BuildContext<Job>>();
    when(mockCtx.env).thenReturn(mockEnv);
    const ctx = instance(mockCtx);

    const npmErrorHandler = createNpmErrorHandler(ctx);
    const fakeError = new Error();
    npmErrorHandler(fakeError, [`Blah blah Error ... ${mockEnv.EAS_BUILD_NPM_CACHE_URL}`]);
    verify(mockCtx.reportError?.('npm cache error', anyOfClass(Error), anything())).called();
  });

  it('does not call reportError for unknown errors', () => {
    const mockEnv = {
      EAS_BUILD_ID: uuidv4(),
      EAS_BUILD_NPM_CACHE_URL: 'https://dominik.sokal.pl/npm/cache',
    };

    const mockCtx = mock<BuildContext<Job>>();
    when(mockCtx.env).thenReturn(mockEnv);
    const ctx = instance(mockCtx);

    const npmErrorHandler = createNpmErrorHandler(ctx);
    const fakeError = new Error();
    npmErrorHandler(fakeError, [`Random Error`]);
    verify(mockCtx.reportError?.(anything(), anyOfClass(Error), anything())).never();
  });
});
