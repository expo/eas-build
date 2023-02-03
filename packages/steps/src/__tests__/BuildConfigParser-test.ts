import path from 'path';
import url from 'url';

import { BuildConfigParser } from '../BuildConfigParser.js';
import { BuildWorkflow } from '../BuildWorkflow.js';
import { getDefaultShell } from '../shell/command.js';

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
  });
});
