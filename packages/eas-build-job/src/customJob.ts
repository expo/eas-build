import { z } from 'zod';

export const CustomJobStepShellZ = z.enum(['sh', 'bash']);

export type CustomJobStepShell = z.infer<typeof CustomJobStepShellZ>;

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
  'working-directory': z.string().optional(),
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

export const CustomJobStepWithUsesFieldZ = CommonCustomJobStepZ.extend({
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
  with: z
    .record(
      z.string(),
      z.union([z.string(), z.number(), z.boolean(), z.record(z.string(), z.any())])
    )
    .optional(),
});

export const CustomJobStepWithRunFieldZ = CommonCustomJobStepZ.extend({
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
  shell: CustomJobStepShellZ.optional(),
});

export const CustomJobStepZ = z.union([CustomJobStepWithUsesFieldZ, CustomJobStepWithRunFieldZ]);

/**
 * Structure of a custom EAS job step.
 * GHA step fields skipped here:
 * - `with.entrypoint`
 * - `continue-on-error`
 * - `timeout-minutes`
 */
export type CustomJobStep = z.infer<typeof CustomJobStepZ>;

export const CustomJobZ = z.object({
  /**
   * Structure of a custom EAS job steps.
   *
   * @example
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
  steps: z.array(CustomJobStepZ),
});

/**
 * Structure of a custom EAS job.
 * Based on the GitHub Actions job structure (https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions#jobsjob_id) that our users are familiar with, plus some additional modifications.
 * GHA job fields skipped here:
 * - `needs` (should be handled on WWW level)
 * - `if` (should be handled on WWW level)
 * - `permissions` (won't be supported for now)
 * - `runs-on` (will be passed as resource class in the top level Job object)
 * - `environment` (resolved environment variables for given environment should be passed in the top level Job object)
 * - `concurrency` (should be handled on WWW level)
 * - `timeout-minutes` TODO
 * - `defaults` TODO
 * - `strategy` (should be handled on WWW level)
 * - outputs TODO
 * - `continue-on-error` (should be handled on WWW level)
 * - `container` (won't be supported for now)
 * - `services` (won't be supported for now)
 * - `uses` ???
 * - `with` ???
 * - `secrets` (should be handled on WWW level)
 */
export type CustomJob = z.infer<typeof CustomJobZ>;
