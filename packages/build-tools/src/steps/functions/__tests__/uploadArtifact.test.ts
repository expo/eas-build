import { createGlobalContextMock } from '../../../__tests__/utils/context';
import { createTestIosJob } from '../../../__tests__/utils/job';
import { createMockLogger } from '../../../__tests__/utils/logger';
import { BuildContext } from '../../../context';
import { CustomBuildContext } from '../../../customBuildContext';
import { createUploadArtifactBuildFunction } from '../uploadArtifact';

describe(createUploadArtifactBuildFunction, () => {
  const ctx = new BuildContext(createTestIosJob({}), {
    env: {},
    logBuffer: { getLogs: () => [], getPhaseLogs: () => [] },
    logger: createMockLogger(),
    uploadArtifact: jest.fn(),
    workingdir: '',
    runGlobalExpoCliCommand: jest.fn(),
  });
  const customContext = new CustomBuildContext(ctx);
  const uploadArtifact = createUploadArtifactBuildFunction(customContext);

  it.each(['build-artifact', 'BUILD_ARTIFACTS'])('accepts %s', async (type) => {
    const buildStep = uploadArtifact.createBuildStepFromFunctionCall(createGlobalContextMock({}), {
      callInputs: {
        type,
        path: '/',
      },
    });
    const typeInput = buildStep.inputs?.find((input) => input.id === 'type')!;
    expect(typeInput.isValueOneOfAllowedValues()).toBe(true);
  });

  it('does not throw for undefined type input', async () => {
    const buildStep = uploadArtifact.createBuildStepFromFunctionCall(createGlobalContextMock({}), {
      callInputs: {
        path: '/',
      },
    });
    for (const input of buildStep.inputs ?? []) {
      expect(input.isValueOneOfAllowedValues()).toBe(true);
    }
  });

  it.each(['invalid-value'])('does not accept %s', async (type) => {
    const buildStep = uploadArtifact.createBuildStepFromFunctionCall(createGlobalContextMock({}), {
      callInputs: {
        type,
        path: '/',
      },
    });
    const typeInput = buildStep.inputs?.find((input) => input.id === 'type')!;
    expect(typeInput.isValueOneOfAllowedValues()).toBe(false);
  });
});
