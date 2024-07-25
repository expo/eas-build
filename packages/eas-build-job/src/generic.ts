import { z } from 'zod';
import { LoggerLevel } from '@expo/logger';

import { ArchiveSourceSchemaZ, BuildTrigger, EnvironmentSecretZ } from './common';
import { StepZ } from './step';

export namespace Generic {
  const BuilderEnvironmentSchemaZ = z.object({
    image: z.string(),
    node: z.string().optional(),
    yarn: z.string().optional(),
    pnpm: z.string().optional(),
    bun: z.string().optional(),
    env: z.record(z.string()),
    // Linux
    ndk: z.string().optional(),
    // macOS
    bundler: z.string().optional(),
    fastlane: z.string().optional(),
    cocoapods: z.string().optional(),
  });

  export type Job = z.infer<typeof JobZ>;
  export const JobZ = z.object({
    projectArchive: ArchiveSourceSchemaZ,
    customBuildConfig: z.object({
      path: z.string(),
    }),
    steps: z.array(StepZ).optional(),
    secrets: z.object({
      robotAccessToken: z.string(),
      environmentSecrets: z.array(EnvironmentSecretZ),
    }),
    expoDevUrl: z.string().url(),
    builderEnvironment: BuilderEnvironmentSchemaZ,
    // We use this to discern between Android.Job, Ios.Job and Generic.Job.
    platform: z.never().optional(),
    type: z.never().optional(),
    triggeredBy: z.literal(BuildTrigger.GIT_BASED_INTEGRATION),
    loggerLevel: z.nativeEnum(LoggerLevel).optional(),
  });
}
