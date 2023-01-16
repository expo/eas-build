import Joi from 'joi';

import { Platform } from './common';
import * as Android from './android';
import * as Ios from './ios';

export type Job = Android.Job | Ios.Job;

export const JobSchema = Joi.object<Job>({
  platform: Joi.string()
    .valid(...Object.values(Platform))
    .required(),
})
  .when(Joi.object({ platform: Platform.ANDROID }).unknown(), { then: Android.JobSchema })
  .when(Joi.object({ platform: Platform.IOS }).unknown(), { then: Ios.JobSchema });

export function sanitizeJob(rawJob: object): Job {
  const { value, error } = JobSchema.validate(rawJob, {
    stripUnknown: true,
    convert: true,
    abortEarly: false,
  });

  const job: Job = value;

  if (error) {
    throw error;
  } else {
    return job;
  }
}
