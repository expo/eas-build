import {
  ArchiveSourceType,
  BuildMode,
  BuildTrigger,
  Ios,
  Platform,
  Workflow,
} from '@expo/eas-build-job';

const iosCredentials: Ios.BuildCredentials = {
  testapp: {
    provisioningProfileBase64: '',
    distributionCertificate: {
      dataBase64: '',
      password: '',
    },
  },
};

export function createTestIosJob({
  buildCredentials = iosCredentials,
}: {
  buildCredentials?: Ios.BuildCredentials;
} = {}): Ios.Job {
  return {
    mode: BuildMode.BUILD,
    platform: Platform.IOS,
    triggeredBy: BuildTrigger.EAS_CLI,
    type: Workflow.GENERIC,
    projectArchive: {
      type: ArchiveSourceType.URL,
      url: 'https://turtle-v2-test-fixtures.s3.us-east-2.amazonaws.com/project.tar.gz',
    },
    scheme: 'turtlebareproj',
    buildConfiguration: 'Release',
    applicationArchivePath: './ios/build/*.ipa',
    projectRootDirectory: '.',
    cache: {
      clear: false,
      disabled: false,
      paths: [],
    },
    secrets: {
      buildCredentials,
    },
  };
}
