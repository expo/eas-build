import { Job, sanitizeJob, ArchiveSourceType } from '@expo/eas-build-job';
import Joi from '@hapi/joi';
import chalk from 'chalk';
import fs from 'fs-extra';
import getStdin from 'get-stdin';

import { registerHandler } from './exit';

const packageJson = require('../package.json');

interface Params {
  job: Job;
}

const ParamsSchema = Joi.object<Params>({
  job: Joi.object().unknown(),
});

export async function parseInputAsync(): Promise<Params> {
  const rawInput = await getStdin();

  if (!rawInput) {
    displayHelp();
    process.exit(1);
  }
  let parsedParams;
  try {
    parsedParams = JSON.parse(rawInput);
  } catch (err) {
    console.error(
      `${chalk.red('The input passed to stdin is not a valid json.')}\n-----\n${rawInput}\n-----`
    );
    throw err;
  }
  const params = validateParams(parsedParams);
  registerHandler(async () => {
    if (params.job.projectArchive.type === ArchiveSourceType.PATH) {
      await fs.remove(params.job.projectArchive.path);
    }
  });
  return params;
}

function validateParams(params: object): Params {
  const { value, error } = ParamsSchema.validate(params, {
    stripUnknown: true,
    convert: true,
    abortEarly: false,
  });
  if (error) {
    throw error;
  }
  try {
    const job = sanitizeJob(value.job);
    return { ...value, job };
  } catch (err) {
    console.log(`Currently using ${packageJson.name}@${packageJson.version}.`);
    console.error(
      chalk.red(
        `Job object has incorrect format, update to latest versions of ${chalk.bold(
          'eas-cli'
        )} and ${chalk.bold(packageJson.name)} to make sure you are using comaptibile packages.`
      )
    );
    throw err;
  }
}

function displayHelp(): void {
  console.log(
    `This tool is not intedend for standalone use, it will be used internally by ${chalk.bold(
      'eas-cli'
    )} when building with flag ${chalk.bold('--local')}.`
  );
}
