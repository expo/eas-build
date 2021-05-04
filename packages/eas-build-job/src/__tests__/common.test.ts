import Joi from '@hapi/joi';

import { ArchiveSourceType, CommonJobSchema } from '../common';

test('invalid updatesRequestHeaders', () => {
  const commonJob = {
    projectArchive: {
      type: ArchiveSourceType.URL,
      url: 'http://localhost:3000',
    },
    projectRootDirectory: '.',
    updatesRequestHeaders: { notString: 5 },
  };
  const { error } = Joi.object(CommonJobSchema).validate(commonJob, {
    stripUnknown: true,
    convert: true,
    abortEarly: false,
  });
  expect(error?.message).toEqual('"updatesRequestHeaders.notString" must be a string');
});
