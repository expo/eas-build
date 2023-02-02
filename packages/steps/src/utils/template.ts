import { BuildConfigError } from '../errors/BuildConfigError.js';

import { nullthrows } from './nullthrows.js';

export const BUILD_STEP_INPUT_EXPRESSION_REGEXP = /\${\s*inputs\.([\S]+)\s*}/;
export const BUILD_STEP_OUTPUT_EXPRESSION_REGEXP = /\${\s*steps\.([\S]+)\s*}/;

export function interpolateWithInputs(
  templateString: string,
  inputs: Record<string, string>
): string {
  return interpolate(templateString, BUILD_STEP_INPUT_EXPRESSION_REGEXP, inputs);
}

export function interpolateWithOutputs(
  templateString: string,
  fn: (path: string) => string
): string {
  return interpolate(templateString, BUILD_STEP_OUTPUT_EXPRESSION_REGEXP, fn);
}

function interpolate(
  templateString: string,
  regex: RegExp,
  varsOrFn: Record<string, string> | ((key: string) => string)
): string {
  const matched = templateString.match(new RegExp(regex, 'g'));
  if (!matched) {
    return templateString;
  }
  let result = templateString;
  for (const match of matched) {
    const [, key] = nullthrows(match.match(regex));
    const value = typeof varsOrFn === 'function' ? varsOrFn(key) : varsOrFn[key];
    result = result.replace(match, value);
  }
  return result;
}

interface BuildOutputPath {
  stepId: string;
  outputId: string;
}

export function parseOutputPath(outputPath: string): BuildOutputPath {
  const splits = outputPath.split('.');
  if (splits.length !== 2) {
    throw new BuildConfigError(
      `Step output path must consist of two components joined with a dot, where first is the step ID, and second is the output name, e.g. "step3.output1". Passed: "${outputPath}"`
    );
  }
  const [stepId, outputId] = splits;
  return { stepId, outputId };
}
