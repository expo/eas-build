import path from 'path';
import url from 'url';

import { BuildConfigParser } from '../BuildConfigParser.js';
import { BuildWorkflow } from '../BuildWorkflow.js';

import { createMockContext } from './utils/context.js';

const __dirname = url.fileURLToPath(new URL('.', import.meta.url));

describe(BuildConfigParser, () => {
  test('dupa', async () => {
    const ctx = createMockContext();
    const parser = new BuildConfigParser(ctx, {
      configPath: path.join(__dirname, './fixtures/build.yml'),
    });
    const result = await parser.parseAsync();
    expect(result).toBeInstanceOf(BuildWorkflow);
  });
});
