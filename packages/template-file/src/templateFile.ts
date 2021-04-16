import _ from 'lodash';
import fs from 'fs-extra';

async function templateFile(
  templateFilePath: string,
  envs: Record<string, string | number | any>,
  outputFilePath?: string,
  { mustache = true }: { mustache?: boolean } = {}
): Promise<string | void> {
  const templateString = await fs.readFile(templateFilePath, 'utf8');
  const compiledTemplate = _.template(
    templateString,
    mustache
      ? {
          // mustache
          interpolate: /{{([\s\S]+?)}}/g,
        }
      : undefined
  );
  const outputFileContents = compiledTemplate(envs);

  if (outputFilePath) {
    await fs.writeFile(outputFilePath, outputFileContents);
  } else {
    return outputFileContents;
  }
}

export default templateFile;
