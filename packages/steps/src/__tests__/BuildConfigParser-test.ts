import path from 'path';
import url from 'url';

import { BuildConfigParser } from '../BuildConfigParser.js';
import { BuildFunction } from '../BuildFunction.js';
import { BuildStepFunction } from '../BuildStep.js';
import { BuildWorkflow } from '../BuildWorkflow.js';
import { BuildConfigError, BuildStepRuntimeError } from '../errors.js';
import { getDefaultShell } from '../utils/shell/command.js';
import { BuildRuntimePlatform } from '../BuildRuntimePlatform.js';
import { BuildStepInputValueTypeName } from '../BuildStepInput.js';

import { createGlobalContextMock } from './utils/context.js';
import { getError, getErrorAsync } from './utils/error.js';
import { UUID_REGEX } from './utils/uuid.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

describe(BuildConfigParser, () => {
  describe('constructor', () => {
    it('throws if provided external functions with duplicated IDs', () => {
      const ctx = createGlobalContextMock();
      const error = getError<BuildStepRuntimeError>(() => {
        // eslint-disable-next-line no-new
        new BuildConfigParser(ctx, {
          configPath: './fake.yml',
          externalFunctions: [
            new BuildFunction({ id: 'abc', command: 'echo 123' }),
            new BuildFunction({ id: 'abc', command: 'echo 456' }),
          ],
        });
      });
      expect(error).toBeInstanceOf(BuildConfigError);
      expect(error.message).toMatch(/Provided external functions with duplicated IDs/);
    });

    it(`doesn't throw if provided external functions don't have duplicated IDs`, () => {
      const ctx = createGlobalContextMock();
      expect(() => {
        // eslint-disable-next-line no-new
        new BuildConfigParser(ctx, {
          configPath: './fake.yml',
          externalFunctions: [
            new BuildFunction({ namespace: 'a', id: 'abc', command: 'echo 123' }),
            new BuildFunction({ namespace: 'b', id: 'abc', command: 'echo 456' }),
          ],
        });
      }).not.toThrow();
    });
  });

  describe(BuildConfigParser.prototype.parseAsync, () => {
    it('returns a BuildWorkflow object', async () => {
      const ctx = createGlobalContextMock();
      const parser = new BuildConfigParser(ctx, {
        configPath: path.join(__dirname, './fixtures/build.yml'),
      });
      const result = await parser.parseAsync();
      expect(result).toBeInstanceOf(BuildWorkflow);
    });

    it('parses steps from the build workflow', async () => {
      const ctx = createGlobalContextMock();
      const parser = new BuildConfigParser(ctx, {
        configPath: path.join(__dirname, './fixtures/build.yml'),
      });
      const workflow = await parser.parseAsync();
      const buildSteps = workflow.buildSteps;
      expect(buildSteps.length).toBe(6);

      // - run: echo "Hi!"
      const step1 = buildSteps[0];
      expect(step1.id).toMatch(UUID_REGEX);
      expect(step1.name).toBeUndefined();
      expect(step1.command).toBe('echo "Hi!"');
      expect(step1.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step1.shell).toBe(getDefaultShell());
      expect(step1.env).toMatchObject({});

      // - run:
      //     name: Say HELLO
      //     command: |
      //       echo "H"
      //       echo "E"
      //       echo "L"
      //       echo "L"
      //       echo "O"
      const step2 = buildSteps[1];
      expect(step2.id).toMatch(UUID_REGEX);
      expect(step2.name).toBe('Say HELLO');
      expect(step2.command).toMatchSnapshot();
      expect(step2.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step2.shell).toBe(getDefaultShell());
      expect(step2.env).toMatchObject({});

      // - run:
      //     id: id_2137
      //     command: echo "Step with an ID"
      //     env:
      //       FOO: bar
      //       BAR: baz
      const step3 = buildSteps[2];
      expect(step3.id).toBe('id_2137');
      expect(step3.name).toBeUndefined();
      expect(step3.command).toBe('echo "Step with an ID"');
      expect(step3.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step3.shell).toBe(getDefaultShell());
      expect(step3.env).toMatchObject({
        FOO: 'bar',
        BAR: 'baz',
      });

      // - run:
      //     name: List files
      //     working_directory: relative/path/to/files
      //     command: ls -la
      const step4 = buildSteps[3];
      expect(step4.id).toMatch(UUID_REGEX);
      expect(step4.name).toBe('List files');
      expect(step4.command).toBe('ls -la');
      expect(step4.ctx.workingDirectory).toBe(
        path.join(ctx.defaultWorkingDirectory, 'relative/path/to/files')
      );
      expect(step4.shell).toBe(getDefaultShell());
      expect(step4.env).toMatchObject({});

      // - run:
      //     name: List files in another directory
      //     working_directory: /home/dsokal
      //     command: ls -la
      const step5 = buildSteps[4];
      expect(step5.id).toMatch(UUID_REGEX);
      expect(step5.name).toBe('List files in another directory');
      expect(step5.command).toBe('ls -la');
      expect(step5.ctx.workingDirectory).toBe('/home/dsokal');
      expect(step5.shell).toBe(getDefaultShell());
      expect(step5.env).toMatchObject({});

      // - run:
      //     name: Use non-default shell
      //     shell: /nib/hsab
      //     command: echo 123
      const step6 = buildSteps[5];
      expect(step6.id).toMatch(UUID_REGEX);
      expect(step6.name).toBe('Use non-default shell');
      expect(step6.command).toBe('echo 123');
      expect(step6.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step6.shell).toBe('/nib/hsab');
      expect(step6.env).toMatchObject({});
    });

    it('parses inputs', async () => {
      const ctx = createGlobalContextMock();
      const parser = new BuildConfigParser(ctx, {
        configPath: path.join(__dirname, './fixtures/inputs.yml'),
      });
      const workflow = await parser.parseAsync();
      const buildSteps = workflow.buildSteps;
      expect(buildSteps.length).toBe(1);

      // - run:
      //   name: Say HI
      //   inputs:
      //     name: Dominik Sokal
      //     country: Poland
      //     boolean_value: true
      //     number_value: 123
      //     json_value:
      //       property1: value1
      //       property2:
      //         - value2
      //         - value3:
      //            property3: value4
      //   command: echo "Hi, ${ inputs.name }, ${ inputs.boolean_value }!"
      const step1 = buildSteps[0];
      expect(step1.id).toMatch(UUID_REGEX);
      expect(step1.name).toBe('Say HI');
      expect(step1.command).toBe('echo "Hi, ${ inputs.name }, ${ inputs.boolean_value }!"');
      expect(step1.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step1.shell).toBe(getDefaultShell());
      expect(step1.inputs).toBeDefined();
      expect(step1.inputs?.[0].id).toBe('name');
      expect(step1.inputs?.[0].value).toBe('Dominik Sokal');
      expect(step1.inputs?.[0].allowedValueTypeName).toBe(BuildStepInputValueTypeName.STRING);
      expect(step1.inputs?.[1].id).toBe('country');
      expect(step1.inputs?.[1].value).toBe('Poland');
      expect(step1.inputs?.[1].allowedValueTypeName).toBe(BuildStepInputValueTypeName.STRING);
      expect(step1.inputs?.[2].id).toBe('boolean_value');
      expect(step1.inputs?.[2].value).toBe(true);
      expect(step1.inputs?.[2].allowedValueTypeName).toBe(BuildStepInputValueTypeName.BOOLEAN);
      expect(step1.inputs?.[3].id).toBe('number_value');
      expect(step1.inputs?.[3].value).toBe(123);
      expect(step1.inputs?.[3].allowedValueTypeName).toBe(BuildStepInputValueTypeName.NUMBER);
      expect(step1.inputs?.[4].id).toBe('json_value');
      expect(step1.inputs?.[4].value).toMatchObject({
        property1: 'value1',
        property2: ['value2', { value3: { property3: 'value4' } }],
      });
      expect(step1.inputs?.[4].allowedValueTypeName).toBe(BuildStepInputValueTypeName.JSON);
    });

    it('parses outputs', async () => {
      const ctx = createGlobalContextMock();
      const parser = new BuildConfigParser(ctx, {
        configPath: path.join(__dirname, './fixtures/outputs.yml'),
      });
      const workflow = await parser.parseAsync();
      const buildSteps = workflow.buildSteps;
      expect(buildSteps.length).toBe(2);

      // - run:
      //     outputs: [first_name, last_name]
      //     command: |
      //       set-output first_name Brent
      //       set-output last_name Vatne
      const step1 = buildSteps[0];
      expect(step1.id).toMatch(UUID_REGEX);
      expect(step1.name).toBeUndefined();
      expect(step1.command).toMatchSnapshot();
      expect(step1.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step1.shell).toBe(getDefaultShell());
      expect(step1.outputs).toBeDefined();
      expect(step1.outputs?.[0].id).toBe('first_name');
      expect(step1.outputs?.[0].required).toBe(true);
      expect(step1.outputs?.[1].id).toBe('last_name');
      expect(step1.outputs?.[1].required).toBe(true);

      // - run:
      //     outputs:
      //       - name: first_name
      //         required: true
      //       - name: middle_name
      //         required: false
      //       - name: last_name
      //       - nickname
      //     command: |
      //       set-output first_name Dominik
      //       set-output last_name Sokal
      //       set-output nickname dsokal
      const step2 = buildSteps[1];
      expect(step2.id).toMatch(UUID_REGEX);
      expect(step2.name).toBeUndefined();
      expect(step2.command).toMatchSnapshot();
      expect(step2.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step2.shell).toBe(getDefaultShell());
      expect(step2.outputs).toBeDefined();
      expect(step2.outputs?.[0].id).toBe('first_name');
      expect(step2.outputs?.[0].required).toBe(true);
      expect(step2.outputs?.[1].id).toBe('middle_name');
      expect(step2.outputs?.[1].required).toBe(false);
      expect(step2.outputs?.[2].id).toBe('last_name');
      expect(step2.outputs?.[2].required).toBe(true);
      expect(step2.outputs?.[3].id).toBe('nickname');
      expect(step2.outputs?.[3].required).toBe(true);
    });

    it('parses functions and function calls', async () => {
      const ctx = createGlobalContextMock();
      const parser = new BuildConfigParser(ctx, {
        configPath: path.join(__dirname, './fixtures/functions.yml'),
      });
      const workflow = await parser.parseAsync();

      const { buildSteps } = workflow;
      expect(buildSteps.length).toBe(7);

      // - say_hi:
      //     env:
      //       ENV1: value1
      //       ENV2: value2
      //     inputs:
      //       name: Dominik
      //       buildNumber: ${ eas.job.version.buildNumber }
      //        json_input:
      //          property1: value1
      //          property2:
      //            - aaa
      //            - bbb
      const step1 = buildSteps[0];
      expect(step1.id).toMatch(UUID_REGEX);
      expect(step1.name).toBe('Hi!');
      expect(step1.command).toBe('echo "Hi, ${ inputs.name }!"');
      expect(step1.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step1.shell).toBe(getDefaultShell());
      expect(step1.inputs?.[0].id).toBe('name');
      expect(step1.inputs?.[0].value).toBe('Dominik');
      expect(step1.inputs?.[0].allowedValueTypeName).toBe(BuildStepInputValueTypeName.STRING);
      expect(step1.inputs?.[1].id).toBe('build_number');
      expect(step1.inputs?.[1].rawValue).toBe('${ eas.job.version.buildNumber }');
      expect(step1.inputs?.[1].allowedValueTypeName).toBe(BuildStepInputValueTypeName.NUMBER);
      expect(step1.inputs?.[2].id).toBe('json_input');
      expect(step1.inputs?.[2].value).toMatchObject({
        property1: 'value1',
        property2: ['aaa', 'bbb'],
      });
      expect(step1.inputs?.[2].allowedValueTypeName).toBe(BuildStepInputValueTypeName.JSON);
      expect(step1.env).toMatchObject({
        ENV1: 'value1',
        ENV2: 'value2',
      });

      // - say_hi:
      //     name: Hi, Szymon!
      //     inputs:
      //       name: Szymon
      //       build_number: 122
      const step2 = buildSteps[1];
      expect(step2.id).toMatch(UUID_REGEX);
      expect(step2.name).toBe('Hi, Szymon!');
      expect(step2.command).toBe('echo "Hi, ${ inputs.name }!"');
      expect(step2.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step2.shell).toBe(getDefaultShell());
      expect(step2.inputs?.[0].id).toBe('name');
      expect(step2.inputs?.[0].value).toBe('Szymon');
      expect(step2.inputs?.[0].allowedValueTypeName).toBe(BuildStepInputValueTypeName.STRING);
      expect(step2.inputs?.[1].id).toBe('build_number');
      expect(step2.inputs?.[1].value).toBe(122);
      expect(step2.inputs?.[1].allowedValueTypeName).toBe(BuildStepInputValueTypeName.NUMBER);
      expect(step2.inputs?.[2].id).toBe('json_input');
      expect(step2.inputs?.[2].value).toMatchObject({
        property1: 'value1',
        property2: ['value2', { value3: { property3: 'value4' } }],
      });
      expect(step2.inputs?.[2].allowedValueTypeName).toBe(BuildStepInputValueTypeName.JSON);
      expect(step2.env).toMatchObject({});

      // - say_hi_wojtek
      const step3 = buildSteps[2];
      expect(step3.id).toMatch(UUID_REGEX);
      expect(step3.name).toBe('Hi, Wojtek!');
      expect(step3.command).toBe('echo "Hi, Wojtek!"');
      expect(step3.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step3.shell).toBe(getDefaultShell());
      expect(step3.env).toMatchObject({});

      // - random:
      //     id: random_number
      const step4 = buildSteps[3];
      expect(step4.id).toMatch('random_number');
      expect(step4.name).toBe('Generate random number');
      expect(step4.command).toBe('set-output value 6');
      expect(step4.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step4.shell).toBe(getDefaultShell());
      expect(step4.outputs?.[0].id).toBe('value');
      expect(step4.outputs?.[0].required).toBe(true);
      expect(step4.env).toMatchObject({});

      // - print:
      //     inputs:
      //       value: ${ steps.random_number.value }
      const step5 = buildSteps[4];
      expect(step5.id).toMatch(UUID_REGEX);
      expect(step5.name).toBe(undefined);
      expect(step5.command).toBe('echo "${ inputs.value }"');
      expect(step5.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step5.shell).toBe(getDefaultShell());
      expect(step5.inputs?.[0].id).toBe('value');
      expect(step5.inputs?.[0].required).toBe(true);
      expect(step5.inputs?.[0].allowedValueTypeName).toBe(BuildStepInputValueTypeName.STRING);
      expect(step5.env).toMatchObject({});

      // - say_hi_2:
      //     inputs:
      //       greeting: Hello
      //       num: 123
      const step6 = buildSteps[5];
      expect(step6.id).toMatch(UUID_REGEX);
      expect(step6.name).toBe('Hi!');
      expect(step6.command).toBe('echo "${ inputs.greeting }, ${ inputs.name }!"');
      expect(step6.ctx.workingDirectory).toBe(ctx.defaultWorkingDirectory);
      expect(step6.shell).toBe(getDefaultShell());
      expect(step6.supportedRuntimePlatforms).toEqual([
        BuildRuntimePlatform.DARWIN,
        BuildRuntimePlatform.LINUX,
      ]);
      expect(step6.inputs?.[0].id).toBe('greeting');
      expect(step6.inputs?.[0].required).toBe(true);
      expect(step6.inputs?.[0].defaultValue).toBe('Hi');
      expect(step6.inputs?.[0].allowedValues).toEqual(['Hi', 'Hello']);
      expect(step6.inputs?.[0].allowedValueTypeName).toBe(BuildStepInputValueTypeName.STRING);
      expect(step6.inputs?.[1].id).toBe('name');
      expect(step6.inputs?.[1].required).toBe(true);
      expect(step6.inputs?.[1].defaultValue).toBe('Brent');
      expect(step6.inputs?.[1].allowedValues).toEqual(undefined);
      expect(step6.inputs?.[1].allowedValueTypeName).toBe(BuildStepInputValueTypeName.STRING);
      expect(step6.inputs?.[2].id).toBe('test');
      expect(step6.inputs?.[2].required).toBe(true);
      expect(step6.inputs?.[2].defaultValue).toBe(false);
      expect(step6.inputs?.[2].allowedValues).toEqual([false, true]);
      expect(step6.inputs?.[2].allowedValueTypeName).toBe(BuildStepInputValueTypeName.BOOLEAN);
      expect(step6.inputs?.[3].id).toBe('number');
      expect(step6.inputs?.[3].required).toBe(true);
      expect(step6.inputs?.[3].defaultValue).toBe(undefined);
      expect(step6.inputs?.[3].allowedValues).toEqual(undefined);
      expect(step6.inputs?.[3].allowedValueTypeName).toBe(BuildStepInputValueTypeName.NUMBER);
      expect(step6.env).toMatchObject({});

      const { buildFunctions } = workflow;
      expect(Object.keys(buildFunctions).length).toBe(6);

      // say_hi:
      //   name: Hi!
      //   inputs:
      //     - name
      //     - name: build_number
      //         type: number
      //     - name: json_input
      //         type: json
      //         default_value:
      //           property1: value1
      //           property2:
      //             - value2
      //             - value3:
      //                 property3: value4
      //   command: echo "Hi, ${ inputs.name }!"
      const function1 = buildFunctions.say_hi;
      expect(function1.id).toBe('say_hi');
      expect(function1.name).toBe('Hi!');
      expect(function1.inputProviders?.[0](ctx, 'unknown-step').id).toBe('name');
      expect(function1.inputProviders?.[0](ctx, 'unknown-step').defaultValue).toBe(undefined);
      expect(function1.inputProviders?.[0](ctx, 'unknown-step').required).toBe(true);
      expect(function1.inputProviders?.[1](ctx, 'unknown-step').id).toBe('build_number');
      expect(function1.inputProviders?.[1](ctx, 'unknown-step').allowedValueTypeName).toBe(
        BuildStepInputValueTypeName.NUMBER
      );
      expect(function1.inputProviders?.[1](ctx, 'unknown-step').defaultValue).toBe(undefined);
      expect(function1.inputProviders?.[1](ctx, 'unknown-step').required).toBe(true);
      expect(function1.inputProviders?.[2](ctx, 'unknown-step').id).toBe('json_input');
      expect(function1.inputProviders?.[2](ctx, 'unknown-step').allowedValueTypeName).toBe(
        BuildStepInputValueTypeName.JSON
      );
      expect(function1.inputProviders?.[2](ctx, 'unknown-step').defaultValue).toEqual({
        property1: 'value1',
        property2: ['value2', { value3: { property3: 'value4' } }],
      });
      expect(function1.command).toBe('echo "Hi, ${ inputs.name }!"');

      // say_hi_wojtek:
      //   name: Hi, Wojtek!
      //   command: echo "Hi, Wojtek!"
      const function2 = buildFunctions.say_hi_wojtek;
      expect(function2.id).toBe('say_hi_wojtek');
      expect(function2.name).toBe('Hi, Wojtek!');
      expect(function2.command).toBe('echo "Hi, Wojtek!"');

      // random:
      //   name: Generate random number
      //   outputs:
      //     - value
      //   command: set-output value 6
      const function3 = buildFunctions.random;
      expect(function3.id).toBe('random');
      expect(function3.name).toBe('Generate random number');
      expect(function3.outputProviders?.[0](ctx, 'unknown-step').id).toBe('value');
      expect(function3.outputProviders?.[0](ctx, 'unknown-step').required).toBe(true);
      expect(function3.command).toBe('set-output value 6');

      // print:
      //   inputs: [value]
      //   command: echo "${ inputs.value }"
      const function4 = buildFunctions.print;
      expect(function4.id).toBe('print');
      expect(function4.name).toBe(undefined);
      expect(function4.inputProviders?.[0](ctx, 'unknown-step').id).toBe('value');
      expect(function4.inputProviders?.[0](ctx, 'unknown-step').required).toBe(true);
      expect(function4.command).toBe('echo "${ inputs.value }"');

      // say_hi_2:
      //  name: Hi!
      //  supported_platforms: [darwin, linux]
      //  inputs:
      //   - name: greeting
      //     default_value: Hi
      //     allowed_values: [Hi, Hello]
      //   - name: name
      //     default_value: Brent
      //   - name: test
      //     default_value: false
      //     allowed_values: [false, true]
      //     type: boolean
      //   - name: number
      //     type: number
      //  command: echo "${ inputs.greeting }, ${ inputs.name }!"
      const function5 = buildFunctions.say_hi_2;
      expect(function5.id).toBe('say_hi_2');
      expect(function5.name).toBe('Hi!');
      expect(function5.inputProviders?.[0](ctx, 'unknown-step').id).toBe('greeting');
      expect(function5.inputProviders?.[0](ctx, 'unknown-step').required).toBe(true);
      expect(function5.inputProviders?.[0](ctx, 'unknown-step').defaultValue).toBe('Hi');
      expect(function5.inputProviders?.[0](ctx, 'unknown-step').allowedValues).toEqual([
        'Hi',
        'Hello',
      ]);
      expect(function5.inputProviders?.[2](ctx, 'unknown-step').allowedValueTypeName).toBe(
        BuildStepInputValueTypeName.BOOLEAN
      );
      expect(function5.inputProviders?.[2](ctx, 'unknown-step').id).toBe('test');
      expect(function5.inputProviders?.[2](ctx, 'unknown-step').required).toBe(true);
      expect(function5.inputProviders?.[2](ctx, 'unknown-step').defaultValue).toBe(false);
      expect(function5.inputProviders?.[2](ctx, 'unknown-step').allowedValues).toEqual([
        false,
        true,
      ]);
      expect(function5.inputProviders?.[3](ctx, 'unknown-step').allowedValueTypeName).toBe(
        BuildStepInputValueTypeName.NUMBER
      );
      expect(function5.inputProviders?.[3](ctx, 'unknown-step').id).toBe('number');
      expect(function5.inputProviders?.[3](ctx, 'unknown-step').required).toBe(true);
      expect(function5.command).toBe('echo "${ inputs.greeting }, ${ inputs.name }!"');
      expect(function5.supportedRuntimePlatforms).toEqual([
        BuildRuntimePlatform.DARWIN,
        BuildRuntimePlatform.LINUX,
      ]);

      // my_ts_fn:
      //  name: My TS function
      //  inputs:
      //   - name: name
      //   - name: num
      //     type: number
      //   - name: obj
      //     type: json
      //  outputs:
      //   - name: name
      //   - name: num
      //   - name: obj
      //  path: ./my-custom-ts-function
      const function6 = buildFunctions.my_ts_fn;
      expect(function6.id).toBe('my_ts_fn');
      expect(function6.name).toBe('My TS function');
      expect(function6.customFunctionModulePath).toMatch(/fixtures\/my-custom-ts-function/);
    });

    it('throws if calling non-existent external functions', async () => {
      const ctx = createGlobalContextMock();
      const parser = new BuildConfigParser(ctx, {
        configPath: path.join(__dirname, './fixtures/external-functions.yml'),
      });
      const error = await getErrorAsync<BuildConfigError>(async () => {
        await parser.parseAsync();
      });
      expect(error).toBeInstanceOf(BuildConfigError);
      expect(error.message).toBe(
        'Calling non-existent functions: "eas/download_project", "eas/build_project".'
      );
    });

    it('works with external functions', async () => {
      const ctx = createGlobalContextMock();

      const downloadProjectFn: BuildStepFunction = (ctx) => {
        ctx.logger.info('Downloading project...');
      };

      const buildProjectFn: BuildStepFunction = (ctx) => {
        ctx.logger.info('Building project...');
      };

      const parser = new BuildConfigParser(ctx, {
        configPath: path.join(__dirname, './fixtures/external-functions.yml'),
        externalFunctions: [
          new BuildFunction({
            namespace: 'eas',
            id: 'download_project',
            fn: downloadProjectFn,
          }),
          new BuildFunction({
            namespace: 'eas',
            id: 'build_project',
            fn: buildProjectFn,
          }),
        ],
      });

      const workflow = await parser.parseAsync();
      expect(workflow.buildSteps.length).toBe(2);

      // - eas/download_project
      const step1 = workflow.buildSteps[0];
      expect(step1.id).toMatch(UUID_REGEX);
      expect(step1.fn).toBe(downloadProjectFn);

      // - eas/build_project
      const step2 = workflow.buildSteps[1];
      expect(step2.id).toMatch(UUID_REGEX);
      expect(step2.fn).toBe(buildProjectFn);
    });
  });
});
