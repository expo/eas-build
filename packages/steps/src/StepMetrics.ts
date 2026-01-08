export type StepMetricResult = 'success' | 'failed';

export type StepMetric = {
  metricsId: string;
  result: StepMetricResult;
  durationMs: number;
  platform: 'darwin' | 'linux';
};

export type StepMetricsCollection = StepMetric[];
