import _ from 'lodash';
import fs from 'fs-extra';

async function templateFile(
  templateString: string,
  envs: Record<string, string | number | any>,
  outputFilePath?: string,
  { mustache = true }: { mustache?: boolean } = {}
): Promise<string | void> {
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
