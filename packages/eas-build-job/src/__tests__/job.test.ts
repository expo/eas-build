import { Workflow } from '../common';
import { setAndroidBuilderImage, setIosBuilderImage } from '../job';

describe(setAndroidBuilderImage, () => {
  test.each([
    { sdkVersion: '45.0.0', reactNativeVersion: '0.69.0', image: 'ubuntu-18.04-jdk-11-ndk-r19c' },
    { sdkVersion: '45.0.0', reactNativeVersion: '0.67.0', image: 'ubuntu-18.04-jdk-8-ndk-r19c' },
    { sdkVersion: '46.0.0', reactNativeVersion: '0.69.0', image: 'ubuntu-20.04-jdk-11-ndk-r21e' },
    { reactNativeVersion: '0.69.0', image: undefined },
    { sdkVersion: '46.0.0', image: undefined },
  ])(
    'selecting image for sdkVersion %s and React Native %s',
    ({
      sdkVersion,
      reactNativeVersion,
      image,
    }: {
      sdkVersion?: string;
      reactNativeVersion?: string;
      image?: string;
    }) => {
      const job: any = { builderEnvironment: {} };
      setAndroidBuilderImage(job, { sdkVersion, reactNativeVersion, workflow: Workflow.MANAGED });
      expect(job?.builderEnvironment?.image).toBe(image);
    }
  );
});

describe(setIosBuilderImage, () => {
  test.each([
    {
      sdkVersion: '44.0.0',
      workflow: Workflow.MANAGED,
      image: 'macos-big-sur-11.4-xcode-13.0',
    },
    {
      sdkVersion: '45.0.0',
      workflow: Workflow.MANAGED,
      image: 'macos-monterey-12.4-xcode-13.4',
    },
    {
      sdkVersion: '46.0.0',
      workflow: Workflow.MANAGED,
      image: 'macos-monterey-12.4-xcode-13.4',
    },
    {
      sdkVersion: '46.0.0',
      workflow: Workflow.GENERIC,
      image: undefined,
    },
    {
      sdkVersion: '47.0.0',
      workflow: Workflow.MANAGED,
      image: 'macos-monterey-12.6-xcode-14.0',
    },
    {
      workflow: Workflow.MANAGED,
      image: undefined,
    },
    {
      sdkVersion: '47.0.0',
      workflow: Workflow.MANAGED,
      image: 'macos-monterey-12.6-xcode-14.0',
    },
    {
      reactNativeVersion: '0.70.0',
      workflow: Workflow.GENERIC,
      image: 'macos-monterey-12.6-xcode-14.0',
    },
  ])(
    'selecting image for sdkVersion %s and React Native %s',
    ({
      sdkVersion,
      reactNativeVersion,
      workflow,
      image,
    }: {
      sdkVersion?: string;
      reactNativeVersion?: string;
      workflow: Workflow;
      image?: string;
    }) => {
      const job: any = { builderEnvironment: {}, type: workflow };
      setIosBuilderImage(job, { sdkVersion, reactNativeVersion, workflow });
      expect(job?.builderEnvironment?.image).toBe(image);
    }
  );
});
