import { anything, instance, mock, verify } from 'ts-mockito';

import { BuildStep } from '../BuildStep.js';
import { BuildStepEnv } from '../BuildStepEnv.js';
import { BuildWorkflow } from '../BuildWorkflow.js';

import { createGlobalContextMock } from './utils/context.js';

describe(BuildWorkflow, () => {
  describe(BuildWorkflow.prototype.executeAsync, () => {
    it('executes all steps passed to the constructor', async () => {
      const mockBuildStep1 = mock<BuildStep>();
      const mockBuildStep2 = mock<BuildStep>();
      const mockBuildStep3 = mock<BuildStep>();
      const mockBuildStep4 = mock<BuildStep>();

      const buildSteps: BuildStep[] = [
        instance(mockBuildStep1),
        instance(mockBuildStep2),
        instance(mockBuildStep3),
      ];

      const ctx = createGlobalContextMock();
      const workflow = new BuildWorkflow(ctx, { buildSteps, buildFunctions: {} });
      await workflow.executeAsync();

      verify(mockBuildStep1.executeAsync(anything())).once();
      verify(mockBuildStep2.executeAsync(anything())).once();
      verify(mockBuildStep3.executeAsync(anything())).once();
      verify(mockBuildStep4.executeAsync(anything())).never();
    });

    it('executes steps in correct order', async () => {
      const mockBuildStep1 = mock<BuildStep>();
      const mockBuildStep2 = mock<BuildStep>();
      const mockBuildStep3 = mock<BuildStep>();

      const buildSteps: BuildStep[] = [
        instance(mockBuildStep1),
        instance(mockBuildStep3),
        instance(mockBuildStep2),
      ];

      const ctx = createGlobalContextMock();
      const workflow = new BuildWorkflow(ctx, { buildSteps, buildFunctions: {} });
      await workflow.executeAsync();

      verify(mockBuildStep1.executeAsync(anything())).calledBefore(
        mockBuildStep3.executeAsync(anything())
      );
      verify(mockBuildStep3.executeAsync(anything())).calledBefore(
        mockBuildStep2.executeAsync(anything())
      );
      verify(mockBuildStep2.executeAsync(anything())).once();
    });

    it('executes steps with environment variables passed to the workflow', async () => {
      const mockBuildStep1 = mock<BuildStep>();
      const mockBuildStep2 = mock<BuildStep>();
      const mockBuildStep3 = mock<BuildStep>();

      const buildSteps: BuildStep[] = [
        instance(mockBuildStep1),
        instance(mockBuildStep3),
        instance(mockBuildStep2),
      ];

      const mockEnv: BuildStepEnv = { ABC: '123' };

      const ctx = createGlobalContextMock();
      const workflow = new BuildWorkflow(ctx, { buildSteps, buildFunctions: {} });
      await workflow.executeAsync(mockEnv);

      verify(mockBuildStep1.executeAsync(mockEnv));
      verify(mockBuildStep2.executeAsync(mockEnv));
      verify(mockBuildStep3.executeAsync(mockEnv));
    });
  });
});
