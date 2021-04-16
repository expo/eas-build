import os from 'os';
import path from 'path';

import fs from 'fs-extra';

import templateFile from '../templateFile';

const templatePath = path.join(__dirname, 'example.json.template');

describe('templateFile', () => {
  const outputFile = path.join(os.tmpdir(), 'output.json');

  afterEach(async () => {
    await fs.remove(outputFile);
  });

  it('should create an output file with the filled-out template', async () => {
    await templateFile(templatePath, { SOME_KEY: 123, ANOTHER_KEY: 456 }, outputFile);
    const outputFileContents = await fs.readFile(outputFile, 'utf8');
    const outputFileJson = JSON.parse(outputFileContents);
    expect(outputFileJson).toEqual({ someKey: 123, anotherKey: 456 });
  });

  it('should throw an error if some variables are missing', async () => {
    const templateFilePromise = templateFile(templatePath, {}, outputFile);
    await expect(templateFilePromise).rejects.toThrow(/is not defined/);
  });
});
