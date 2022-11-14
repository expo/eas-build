import Joi from 'joi';
import semver from 'semver';

import { ImageMatchRule, Platform, Workflow } from './common';
import * as Android from './android';
import * as Ios from './ios';

export type Job = Android.Job | Ios.Job;

interface ImageMatchArgs {
  sdkVersion?: string;
  reactNativeVersion?: string;
  workflow: Workflow;
}

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
  if (!job?.builderEnvironment?.image) {
    const resolveArgs: ImageMatchArgs = {
      sdkVersion,
      reactNativeVersion,
      workflow: job.type,
    };
    if (job.platform === Platform.IOS) {
      setIosBuilderImage(job, resolveArgs);
    } else if (job.platform === Platform.ANDROID) {
      setAndroidBuilderImage(job, resolveArgs);
    }
  }

  if (error) {
    throw error;
  } else {
    return job;
  }
}

function doesImageRuleMatch<T extends string>(
  rule: ImageMatchRule<T>,
  { sdkVersion, reactNativeVersion, workflow }: ImageMatchArgs
): boolean {
  if (rule.reactNativeSemverRange) {
    if (!reactNativeVersion || !semver.satisfies(reactNativeVersion, rule.reactNativeSemverRange)) {
      return false;
    }
  }
  if (rule.sdkSemverRange) {
    if (!sdkVersion || !semver.satisfies(sdkVersion, rule.sdkSemverRange)) {
      return false;
    }
  }
  if (rule.workflows) {
    if (!workflow || !rule.workflows.includes(workflow)) {
      return false;
    }
  }
  return true;
}

export function setAndroidBuilderImage(job: Job, args: ImageMatchArgs): void {
  for (const rule of Android.imageMatchRules) {
    if (doesImageRuleMatch(rule, args)) {
      job.builderEnvironment = {
        ...job.builderEnvironment,
        image: rule.image,
      };
      return;
    }
  }
}

export function setIosBuilderImage(job: Job, args: ImageMatchArgs): void {
  for (const rule of Ios.imageMatchRules) {
    if (doesImageRuleMatch(rule, args)) {
      job.builderEnvironment = {
        ...job.builderEnvironment,
        image: rule.image,
      };
      return;
    }
  }
}
