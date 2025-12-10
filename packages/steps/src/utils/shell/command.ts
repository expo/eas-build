// stolen from https://circleci.com/docs/configuration-reference/
const DEFAULT_SHELL = '/bin/bash -eo pipefail';

export function getDefaultShell(): string {
  return DEFAULT_SHELL;
}

export function getShellCommandAndArgs(
  shell: string,
  script?: string
): { command: string; args?: string[] } {
  const splits = shell.split(' ');
  const command = splits[0];
  const args = [...splits.slice(1)];
  if (script) {
    args.push(script);
  }
  return {
    command,
    args,
  };
}
