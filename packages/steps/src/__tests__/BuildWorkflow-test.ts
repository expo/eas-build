import { anything, instance, mock, verify, when } from 'ts-mockito';

import { BuildStep, BuildStepStatus } from '../BuildStep.js';
import { BuildStepEnv } from '../BuildStepEnv.js';
import { BuildWorkflow } from '../BuildWorkflow.js';

import { createMockContext } from './utils/context.js';

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

      const ctx = createMockContext();
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

      const ctx = createMockContext();
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

      const ctx = createMockContext();
      const workflow = new BuildWorkflow(ctx, { buildSteps, buildFunctions: {} });
      await workflow.executeAsync(mockEnv);

      verify(mockBuildStep1.executeAsync(mockEnv));
      verify(mockBuildStep2.executeAsync(mockEnv));
      verify(mockBuildStep3.executeAsync(mockEnv));
    });

    it('executes steps with environment variables passed to the workflow', async () => {
      const ctx = createMockContext();
      const mockBuildStep1 = mock<BuildStep>();
      const mockBuildStep2 = mock<BuildStep>();

      when(mockBuildStep2.shouldAlwaysRun).thenReturn(true);
      when(mockBuildStep2.status).thenReturn(BuildStepStatus.NEW);

      const failingBuildStep = new BuildStep(ctx, {
        id: 'someid',
        displayName: 'somename',
        fn: () => {
          throw new Error('this will fail');
        },
      });

      const buildSteps: BuildStep[] = [
        failingBuildStep,
        instance(mockBuildStep1),
        instance(mockBuildStep2),
      ];
      const mockEnv: BuildStepEnv = { ABC: '123' };
      const workflow = new BuildWorkflow(ctx, { buildSteps, buildFunctions: {} });
      try {
        await workflow.executeAsync(mockEnv);
      } catch {}

      verify(mockBuildStep1.executeAsync(mockEnv)).never();
      verify(mockBuildStep2.executeAsync(mockEnv)).once();
    });
  });
});
