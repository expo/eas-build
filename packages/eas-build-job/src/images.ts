export const workerImageAliases = ['default', 'latest', 'sdk-50', 'sdk-49'] as const;

export const iosWorkerImagesWithoutAliases = [
  'macos-monterey-12.1-xcode-13.2',
  'macos-monterey-12.3-xcode-13.3',
  'macos-monterey-12.4-xcode-13.4',
  'macos-monterey-12.6-xcode-14.0',
  'macos-monterey-12.6-xcode-14.1',
  'macos-monterey-12.6-xcode-14.2',
  'macos-ventura-13.3-xcode-14.3',
  'macos-ventura-13.4-xcode-14.3.1',
  'macos-ventura-13.6-xcode-15.0',
  'macos-ventura-13.6-xcode-15.1',
  'macos-ventura-13.6-xcode-15.2',
] as const;

export const iosWorkerImages = [...workerImageAliases, ...iosWorkerImagesWithoutAliases] as const;

export const androidWorkerImagesWithoutAliases = [
  'ubuntu-20.04-jdk-8-ndk-r19c',
  'ubuntu-20.04-jdk-11-ndk-r19c',
  'ubuntu-20.04-jdk-8-ndk-r21e',
  'ubuntu-20.04-jdk-11-ndk-r21e',
  'ubuntu-22.04-jdk-8-ndk-r21e',
  'ubuntu-22.04-jdk-11-ndk-r21e',
  'ubuntu-22.04-jdk-17-ndk-r21e',
] as const;

export const androidWorkerImages = [
  ...workerImageAliases,
  ...androidWorkerImagesWithoutAliases,
] as const;

export const androidImagesWithJavaVersionLowerThen11 = [
  'ubuntu-20.04-jdk-8-ndk-r19c',
  'ubuntu-20.04-jdk-11-ndk-r19c',
  'ubuntu-20.04-jdk-8-ndk-r21e',
  'ubuntu-20.04-jdk-11-ndk-r21e',
  'ubuntu-22.04-jdk-8-ndk-r21e',
  'ubuntu-22.04-jdk-11-ndk-r21e',
];
export type WorkerImageAlias = (typeof workerImageAliases)[number];

export type IosWorkerImageWithAliases = (typeof iosWorkerImages)[number];

export type AndroidWorkerImageWithAliases = (typeof androidWorkerImages)[number];

export type IosWorkerImageWithoutAliases = (typeof iosWorkerImagesWithoutAliases)[number];

export type AndroidWorkerImageWithoutAliases = (typeof androidWorkerImagesWithoutAliases)[number];

export type IosWorkerImageAliasToImageMapping = Record<
  WorkerImageAlias,
  IosWorkerImageWithoutAliases
>;

export type AndroidWorkerImageAliasToImageMapping = Record<
  WorkerImageAlias,
  AndroidWorkerImageWithoutAliases
>;

export function isImageAlias(image: string): image is WorkerImageAlias {
  return workerImageAliases.includes(image as WorkerImageAlias);
}
