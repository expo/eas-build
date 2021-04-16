import Joi from '@hapi/joi';

import { Platform } from './common';
import * as Android from './android';
import * as Ios from './ios';

type Job = Android.Job | Ios.Job;

const JobSchema = Joi.object<Job>({
  platform: Joi.string()
    .valid(...Object.values(Platform))
    .required(),
})
  .when(Joi.object({ platform: Platform.ANDROID }).unknown(), { then: Android.JobSchema })
  .when(Joi.object({ platform: Platform.IOS }).unknown(), { then: Ios.JobSchema });

function sanitizeJob(job: object): Job {
  const { value, error } = JobSchema.validate(job, {
    stripUnknown: true,
    convert: true,
    abortEarly: false,
  });
  if (error) {
    throw error;
  } else {
    return value;
  }
}

export { Job, JobSchema, sanitizeJob };
