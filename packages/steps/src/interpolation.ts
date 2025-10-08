import { JobInterpolationContext } from '@expo/eas-build-job';

import { jsepEvalAsync } from './utils/jsepEval.js';

export async function interpolateJobContextAsync({
  target,
  context,
}: {
  target: unknown;
  context: JobInterpolationContext;
}): Promise<unknown> {
  if (typeof target === 'string') {
    // If the value is e.g. `build: ${{ inputs.build }}`, we will interpolate the value
    // without changing `inputs.build` type, i.e. if it is an object it'll be like `build: {...inputs.build}`.
    if (target.startsWith('${{') && target.endsWith('}}')) {
      return await jsepEvalAsync(target.slice(3, -2), context);
    }

    // Otherwise we replace all occurrences of `${{...}}` with the result of the expression.
    // e.g. `echo ${{ build.profile }}` becomes `echo production`.
    const matches = Array.from(target.matchAll(/\$\{\{(.+?)\}\}/g));
    let result = target;
    for (const match of matches) {
      const expression = match[1];
      const value = await jsepEvalAsync(expression, context);
      result = result.replace(match[0], `${value}`);
    }
    return result;
  } else if (Array.isArray(target)) {
    return await Promise.all(
      target.map((value) => interpolateJobContextAsync({ target: value, context }))
    );
  } else if (typeof target === 'object' && target) {
    return Object.fromEntries(
      await Promise.all(
        Object.entries(target).map(async ([key, value]) => {
          return [key, await interpolateJobContextAsync({ target: value, context })];
        })
      )
    );
  }
  return target;
}
