import Joi from 'joi';
import semver from 'semver';

import { Platform, Workflow } from './common';
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

export function sanitizeJob(
  rawJob: object,
  { sdkVersion, reactNativeVersion }: { reactNativeVersion?: string; sdkVersion?: string } = {}
): Job {
  const { value, error } = JobSchema.validate(rawJob, {
    stripUnknown: true,
    convert: true,
    abortEarly: false,
  });

  const job: Job = value;
  if (job.platform === Platform.IOS) {
    setIosBuilderImageForManagedJob(job, sdkVersion);
  } else if (job.platform === Platform.ANDROID) {
    setAndroidBuilderImage(job, reactNativeVersion);
  }

  if (error) {
    throw error;
  } else {
    return job;
  }
}

function setAndroidBuilderImage(job: Job, reactNativeVersion?: string): void {
  if (!(!job.builderEnvironment?.image && reactNativeVersion)) {
    return;
  }

  const ranges = Object.keys(Android.reactNativeVersionToDefaultBuilderImage);
  const matchingRange = ranges.find((range) => semver.satisfies(reactNativeVersion, range));
  if (!matchingRange) {
    return;
  }
  const image = Android.reactNativeVersionToDefaultBuilderImage[matchingRange];
  job.builderEnvironment = {
    image,
    ...job.builderEnvironment,
  };
}

function setIosBuilderImageForManagedJob(job: Job, sdkVersion?: string): void {
  if (!(job.type === Workflow.MANAGED && !job.builderEnvironment?.image && sdkVersion)) {
    return;
  }

  const ranges = Object.keys(Ios.sdkVersionToDefaultBuilderImage);
  const matchingRange = ranges.find((range) => semver.satisfies(sdkVersion, range));
  if (!matchingRange) {
    return;
  }
  const image = Ios.sdkVersionToDefaultBuilderImage[matchingRange];
  job.builderEnvironment = {
    image,
    ...job.builderEnvironment,
  };
}
