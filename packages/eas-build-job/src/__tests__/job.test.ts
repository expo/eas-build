import { Workflow } from '../common';
import { setAndroidBuilderImage, setIosBuilderImageForManagedJob } from '../job';

function testAndroidImage(
  sdkVersion?: string,
  reactNativeVersion?: string,
  expectedImage?: string
): void {
  const job: any = { builderEnvironment: {} };
  setAndroidBuilderImage(job, sdkVersion, reactNativeVersion);
  expect(job?.builderEnvironment?.image).toBe(expectedImage);
}

describe(setAndroidBuilderImage, () => {
  test('selecting image', () => {
    testAndroidImage('45.0.0', '0.69.0', 'ubuntu-18.04-jdk-11-ndk-r19c');
    testAndroidImage('45.0.0', '0.67.0', 'ubuntu-18.04-jdk-8-ndk-r19c');
    testAndroidImage('46.0.0', '0.69.0', 'ubuntu-20.04-jdk-11-ndk-r21e');
    testAndroidImage(undefined, '0.69.0', undefined);
    testAndroidImage('46.0.0', undefined, undefined);
  });
});

function testIosImage(
  sdkVersion: string | undefined,
  workflow: Workflow,
  expectedImage: string | undefined
): void {
  const job: any = { builderEnvironment: {}, type: workflow };
  setIosBuilderImageForManagedJob(job, sdkVersion);
  expect(job?.builderEnvironment?.image).toBe(expectedImage);
}

describe(setIosBuilderImageForManagedJob, () => {
  test('selecting image', () => {
    testIosImage('44.0.0', Workflow.MANAGED, 'macos-big-sur-11.4-xcode-13.0');
    testIosImage('45.0.0', Workflow.MANAGED, 'macos-monterey-12.3-xcode-13.3');
    testIosImage('46.0.0', Workflow.MANAGED, 'macos-monterey-12.3-xcode-13.3');
    testIosImage('46.0.0', Workflow.GENERIC, undefined);
    testIosImage(undefined, Workflow.MANAGED, undefined);
  });
});
