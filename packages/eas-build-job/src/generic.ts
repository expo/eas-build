import { z } from 'zod';

import { ArchiveSourceSchemaZ, EnvironmentSecretZ } from './common';

export namespace Generic {
  const BuilderEnvironmentSchemaZ = z.object({
    image: z.string(),
    node: z.string().optional(),
    yarn: z.string().optional(),
    pnpm: z.string().optional(),
    bun: z.string().optional(),
    expoCli: z.string().optional(),
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
    secrets: z.object({
      robotAccessToken: z.string(),
      environmentSecrets: z.array(EnvironmentSecretZ),
    }),
    expoDevUrl: z.string().url(),
    builderEnvironment: BuilderEnvironmentSchemaZ,
  });
}
