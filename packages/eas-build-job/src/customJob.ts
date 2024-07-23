import { z } from 'zod';

const CommonCustomJobStepZ = z.object({
  /**
   * Unique identifier for the step.
   *
   * @example
   * id: 'step1'
   */
  id: z.string().optional(),
  /**
   * Expression that determines whether the step should run.
   * Based on the GitHub Actions job step `if` field (https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_idstepsif).
   *
   * @example
   * if: '${{ steps.step1.outputs.test == 'test' }}'
   */
  if: z.string().optional(),
  /**
   * The name of the step.
   *
   * @example
   * name: 'Step 1'
   */
  name: z.string().optional(),
  /**
   * The working directory to run the step in.
   *
   * @example
   * working-directory: './my-working-directory'
   *
   * @default '.' (the root of the repository)
   */
  working_directory: z.string().optional(),
  /**
   * Env variables override for the step.
   *
   * @example
   * env:
   *  MY_ENV_VAR: 'my-value'
   *  ANOTHER_ENV_VAR: 'another-value'
   */
  env: z.record(z.string()).optional(),
});

export const CustomJobFunctionStepZ = CommonCustomJobStepZ.extend({
  /**
   * The custom EAS function to run as a step.
   * It can be a function provided by EAS or a custom function defined by the user.
   *
   * @example
   * uses: 'eas/build'
   *
   * @example
   * uses: 'my-custom-function'
   */
  uses: z.string(),
  /**
   * The arguments to pass to the function.
   *
   * @example
   * with:
   *  arg1: 'value1'
   *  arg2: ['ala', 'ma', 'kota']
   *  arg3:
   *   key1: 'value1'
   *   key2:
   *    - 'value1'
   *  arg4: '${{ steps.step1.outputs.test }}'
   */
  with: z.record(z.unknown()).optional(),

  run: z.never().optional(),
  shell: z.never().optional(),
}).strict();

export type CustomJobFunctionStep = z.infer<typeof CustomJobFunctionStepZ>;

export const CustomJobScriptStepZ = CommonCustomJobStepZ.extend({
  /**
   * The command-line programs to run as a step.
   *
   * @example
   * run: 'echo Hello, world!'
   *
   * @example
   * run: |
   *  npm install
   *  npx expo prebuild
   *  pod install
   */
  run: z.string(),
  /**
   * The shell to run the "run" command with.
   *
   * @example
   * shell: 'sh'
   *
   * @default 'bash'
   */
  shell: z.string().optional(),

  uses: z.never().optional(),
  with: z.never().optional(),
}).strict();

export type CustomJobScriptStep = z.infer<typeof CustomJobScriptStepZ>;

export const CustomJobStepZ = z.union([CustomJobScriptStepZ, CustomJobFunctionStepZ]);

/**
 * Structure of a custom EAS job step.
 *
 * GHA step fields skipped here:
 * - `with.entrypoint`
 * - `continue-on-error`
 * - `timeout-minutes`
 *
 * * @example
 * steps:
 *  - uses: 'eas/maestro-test'
 *    id: 'step1'
 *    name: 'Step 1'
 *    with:
 *     flow_path: |
 *        maestro/sign_in.yaml
 *        maestro/create_post.yaml
 *        maestro/sign_out.yaml
 *  - run: 'echo Hello, world!'
 */
export type CustomJobStep = z.infer<typeof CustomJobStepZ>;

export const CustomJobStepsZ = z.array(CustomJobStepZ);

export type CustomJobSteps = z.infer<typeof CustomJobStepsZ>;
