export enum BuildArtifactType {
  APPLICATION_ARCHIVE = 'application-archive',
  BUILD_ARTIFACT = 'build-artifact',
}

export type BuildArtifacts = Partial<Record<BuildArtifactType, string[]>>;
