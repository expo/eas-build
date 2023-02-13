import path from 'path';
import url from 'url';

import { BuildConfigParser } from '../BuildConfigParser.js';
import { BuildWorkflow } from '../BuildWorkflow.js';
import { getDefaultShell } from '../utils/shell/command.js';

import { createMockContext } from './utils/context.js';

const UUID_REGEX =
  /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

describe(BuildConfigParser, () => {
  describe(BuildConfigParser.prototype.parseAsync, () => {
    it('returns a BuildWorkflow object', async () => {
      const ctx = createMockContext();
      const parser = new BuildConfigParser(ctx, {
        configPath: path.join(__dirname, './fixtures/build.yml'),
      });
      const result = await parser.parseAsync();
      expect(result).toBeInstanceOf(BuildWorkflow);
    });

    it('parses steps from the build workflow', async () => {
      const ctx = createMockContext();
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
      expect(step1.workingDirectory).toBe(ctx.workingDirectory);
      expect(step1.shell).toBe(getDefaultShell());

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
      expect(step2.workingDirectory).toBe(ctx.workingDirectory);
      expect(step2.shell).toBe(getDefaultShell());

      // - run:
      //     id: id_2137
      //     command: echo "Step with an ID"
      const step3 = buildSteps[2];
      expect(step3.id).toBe('id_2137');
      expect(step3.name).toBeUndefined();
      expect(step3.command).toBe('echo "Step with an ID"');
      expect(step3.workingDirectory).toBe(ctx.workingDirectory);
      expect(step3.shell).toBe(getDefaultShell());

      // - run:
      //     name: List files
      //     working_directory: relative/path/to/files
      //     command: ls -la
      const step4 = buildSteps[3];
      expect(step4.id).toMatch(UUID_REGEX);
      expect(step4.name).toBe('List files');
      expect(step4.command).toBe('ls -la');
      expect(step4.workingDirectory).toBe(
        path.join(ctx.workingDirectory, 'relative/path/to/files')
      );
      expect(step4.shell).toBe(getDefaultShell());

      // - run:
      //     name: List files in another directory
      //     working_directory: /home/dsokal
      //     command: ls -la
      const step5 = buildSteps[4];
      expect(step5.id).toMatch(UUID_REGEX);
      expect(step5.name).toBe('List files in another directory');
      expect(step5.command).toBe('ls -la');
      expect(step5.workingDirectory).toBe('/home/dsokal');
      expect(step5.shell).toBe(getDefaultShell());

      // - run:
      //     name: Use non-default shell
      //     shell: /nib/hsab
      //     command: echo 123
      const step6 = buildSteps[5];
      expect(step6.id).toMatch(UUID_REGEX);
      expect(step6.name).toBe('Use non-default shell');
      expect(step6.command).toBe('echo 123');
      expect(step6.workingDirectory).toBe(ctx.workingDirectory);
      expect(step6.shell).toBe('/nib/hsab');
    });

    it('parses inputs', async () => {
      const ctx = createMockContext();
      const parser = new BuildConfigParser(ctx, {
        configPath: path.join(__dirname, './fixtures/inputs.yml'),
      });
      const workflow = await parser.parseAsync();
      const buildSteps = workflow.buildSteps;
      expect(buildSteps.length).toBe(1);

      // - run:
      //     name: Say HI
      //     inputs:
      //       name: Dominik Sokal
      //       country: Poland
      //     command: |
      //       echo "Hi, ${ inputs.name }!"
      const step1 = buildSteps[0];
      expect(step1.id).toMatch(UUID_REGEX);
      expect(step1.name).toBe('Say HI');
      expect(step1.command).toBe('echo "Hi, ${ inputs.name }!"');
      expect(step1.workingDirectory).toBe(ctx.workingDirectory);
      expect(step1.shell).toBe(getDefaultShell());
      expect(step1.inputs).toBeDefined();
      expect(step1.inputs?.[0].id).toBe('name');
      expect(step1.inputs?.[0].value).toBe('Dominik Sokal');
      expect(step1.inputs?.[1].id).toBe('country');
      expect(step1.inputs?.[1].value).toBe('Poland');
    });

    it('parses outputs', async () => {
      const ctx = createMockContext();
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
      expect(step1.workingDirectory).toBe(ctx.workingDirectory);
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
      expect(step2.workingDirectory).toBe(ctx.workingDirectory);
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
  });
});
