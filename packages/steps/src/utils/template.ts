import get from 'lodash.get';

import { BuildStepInputValueTypeName } from '../BuildStepInput.js';
import { BuildConfigError, BuildStepRuntimeError } from '../errors.js';

import { nullthrows } from './nullthrows.js';

export const BUILD_STEP_INPUT_EXPRESSION_REGEXP = /\${\s*(inputs\.[\S]+)\s*}/;
export const BUILD_STEP_OUTPUT_EXPRESSION_REGEXP = /\${\s*(steps\.[\S]+)\s*}/;
export const BUILD_GLOBAL_CONTEXT_EXPRESSION_REGEXP = /\${\s*(eas\.[\S]+)\s*}/;
export const BUILD_STEP_OR_BUILD_GLOBAL_CONTEXT_REFERENCE_REGEX = /\${\s*((steps|eas)\.[\S]+)\s*}/;
export const BUILD_STEP_IF_CONDITION_EXPRESSION_REGEXP = /\${\s*((always|success|failure)\(\))\s*}/;

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

/**
 * Returns the selected status check from the if statement template.
 * Example: `${ success() }` -> `success`
 */
// TODO @szdziedzic: add support for cancelled
export function getSelectedStatusCheckFromIfStatementTemplate(
  ifCondition: string
): 'success' | 'failure' | 'always' {
  const matched = ifCondition.match(new RegExp(BUILD_STEP_IF_CONDITION_EXPRESSION_REGEXP, 'g'));
  if (!matched) {
    // this should never happen because of regex pattern validation
    throw new BuildConfigError(`Invalid if condition template.`);
  }
  const [, , selectedStatusCheck] = nullthrows(
    matched[0].match(BUILD_STEP_IF_CONDITION_EXPRESSION_REGEXP)
  );
  return selectedStatusCheck as 'success' | 'failure' | 'always';
}

export function getObjectValueForInterpolation(
  path: string,
  obj: Record<string, any>
): string | number | boolean | null {
  const value = get(obj, path);

  if (value === undefined) {
    throw new BuildStepRuntimeError(
      `Object field "${path}" does not exist. Ensure you are using the correct field name.`
    );
  }

  if (!isAllowedValueTypeForObjectInterpolation(value)) {
    throw new BuildStepRuntimeError(
      `EAS context field "${path}" is not of type ${Object.values(BuildStepInputValueTypeName).join(
        ', '
      )}, or undefined. It is of type "${typeof value}". We currently only support accessing string or undefined values from the EAS context.`
    );
  }

  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }

  return value;
}

export function interpolateWithGlobalContext(
  templateString: string,
  fn: (path: string) => string
): string {
  return interpolate(templateString, BUILD_GLOBAL_CONTEXT_EXPRESSION_REGEXP, fn);
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
    const [, path] = nullthrows(match.match(regex));
    const value = typeof varsOrFn === 'function' ? varsOrFn(path) : varsOrFn[path.split('.')[1]];
    result = result.replace(match, value);
  }
  return result;
}

function isAllowedValueTypeForObjectInterpolation(
  value: any
): value is string | number | boolean | object | null {
  return (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean' ||
    typeof value === 'object' ||
    value === null
  );
}

interface BuildOutputPath {
  stepId: string;
  outputId: string;
}

export function findOutputPaths(templateString: string): BuildOutputPath[] {
  const result: BuildOutputPath[] = [];
  const matches = templateString.matchAll(new RegExp(BUILD_STEP_OUTPUT_EXPRESSION_REGEXP, 'g'));
  for (const match of matches) {
    result.push(parseOutputPath(match[1]));
  }
  return result;
}

export function parseOutputPath(outputPathWithObjectName: string): BuildOutputPath {
  const splits = outputPathWithObjectName.split('.').slice(1);
  if (splits.length !== 2) {
    throw new BuildConfigError(
      `Step output path must consist of two components joined with a dot, where first is the step ID, and second is the output name, e.g. "step3.output1". Passed: "${outputPathWithObjectName}"`
    );
  }
  const [stepId, outputId] = splits;
  return { stepId, outputId };
}
