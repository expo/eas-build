import { Workflow } from '../common';
import { setAndroidBuilderImage, setIosBuilderImageForManagedJob } from '../job';

describe(setAndroidBuilderImage, () => {
  test.each([
    ['45.0.0', '0.69.0', 'ubuntu-18.04-jdk-11-ndk-r19c'],
    ['45.0.0', '0.67.0', 'ubuntu-18.04-jdk-8-ndk-r19c'],
    ['46.0.0', '0.69.0', 'ubuntu-20.04-jdk-11-ndk-r21e'],
    [undefined, '0.69.0', undefined],
    ['46.0.0', undefined, undefined],
  ])(
    'selecting image for sdkVersion %s and React Native %s',
    (sdkVersion?: string, reactNativeVersion?: string, expectedImage?: string) => {
      const job: any = { builderEnvironment: {} };
      setAndroidBuilderImage(job, sdkVersion, reactNativeVersion);
      expect(job?.builderEnvironment?.image).toBe(expectedImage);
    }
  );
});

describe(setIosBuilderImageForManagedJob, () => {
  test.each([
    ['44.0.0', Workflow.MANAGED, 'macos-big-sur-11.4-xcode-13.0'],
    ['45.0.0', Workflow.MANAGED, 'macos-monterey-12.3-xcode-13.3'],
    ['46.0.0', Workflow.MANAGED, 'macos-monterey-12.3-xcode-13.3'],
    ['46.0.0', Workflow.GENERIC, undefined],
    [undefined, Workflow.MANAGED, undefined],
  ])(
    'selecting image for sdkVersion %s and React Native %s',
    (sdkVersion: string | undefined, workflow: Workflow, expectedImage: string | undefined) => {
      const job: any = { builderEnvironment: {}, type: workflow };
      setIosBuilderImageForManagedJob(job, sdkVersion);
      expect(job?.builderEnvironment?.image).toBe(expectedImage);
    }
  );
});
