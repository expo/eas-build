import { instance, mock, verify } from 'ts-mockito';

import { BuildStep } from '../BuildStep.js';
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

      verify(mockBuildStep1.executeAsync()).once();
      verify(mockBuildStep2.executeAsync()).once();
      verify(mockBuildStep3.executeAsync()).once();
      verify(mockBuildStep4.executeAsync()).never();
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

      verify(mockBuildStep1.executeAsync()).calledBefore(mockBuildStep3.executeAsync());
      verify(mockBuildStep3.executeAsync()).calledBefore(mockBuildStep2.executeAsync());
      verify(mockBuildStep2.executeAsync()).once();
    });
  });
});
