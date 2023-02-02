import { getDefaultShell, getShellCommandAndArgs } from '../command.js';

describe(getDefaultShell, () => {
  test(`platform = "darwin"`, () => {
    expect(getDefaultShell('darwin')).toBe('/bin/bash --login -eo pipefail');
  });

  const nonDarwinPlatforms: NodeJS.Platform[] = [
    'aix',
    'android',
    'freebsd',
    'linux',
    'openbsd',
    'sunos',
    'win32',
    'cygwin',
    'netbsd',
  ];
  test.each(nonDarwinPlatforms)('platform = %p', (platform) => {
    expect(getDefaultShell(platform)).toBe('/bin/bash -eo pipefail');
  });
});

describe(getShellCommandAndArgs, () => {
  test('shell command with arguments', () => {
    const { command, args } = getShellCommandAndArgs(
      '/bin/bash -eo pipefail',
      '/path/to/script.sh'
    );
    expect(command).toBe('/bin/bash');
    expect(args).toEqual(['-eo', 'pipefail', '/path/to/script.sh']);
  });
  test('shell command without arguments', () => {
    const { command, args } = getShellCommandAndArgs('/bin/bash', '/path/to/script.sh');
    expect(command).toBe('/bin/bash');
    expect(args).toEqual(['/path/to/script.sh']);
  });
});
