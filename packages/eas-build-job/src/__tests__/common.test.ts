import { StaticWorkflowInterpolationContextZ } from '../common';

describe('StaticWorkflowInterpolationContextZ', () => {
  it('accepts app and account context', () => {
    const context = {
      after: {},
      needs: {},
      workflow: {
        id: 'workflow-id',
        name: 'workflow-name',
        filename: 'workflow.yml',
        url: 'https://expo.dev/accounts/example/workflows/workflow-id',
      },
      app: {
        id: 'app-id',
        slug: 'app-slug',
      },
      account: {
        id: 'account-id',
        name: 'account-name',
      },
    };

    expect(StaticWorkflowInterpolationContextZ.parse(context)).toEqual(context);
  });

  it('rejects invalid app and account context', () => {
    const context = {
      after: {},
      needs: {},
      workflow: {
        id: 'workflow-id',
        name: 'workflow-name',
        filename: 'workflow.yml',
        url: 'https://expo.dev/accounts/example/workflows/workflow-id',
      },
      app: {
        id: 123,
        slug: null,
      },
      account: {
        id: null,
        name: 456,
      },
    };

    expect(() => StaticWorkflowInterpolationContextZ.parse(context)).toThrow();
  });
});
