import { type SpawnOptions } from '@expo/turtle-spawn';

const actualSpawn = jest.requireActual('@expo/turtle-spawn').default;

// Because we use self-signed certificates in tests,
// we need to patch the `security find-identity` command without using the `-v` flag.
const mockTurtleSpawn = jest
  .fn()
  .mockImplementation((command: string, args: string[], options?: SpawnOptions) => {
    let patchedArgs: string[];
    if (command === 'security' && args[0] === 'find-identity') {
      patchedArgs = args.filter((arg) => arg !== '-v');
    } else {
      patchedArgs = args;
    }
    return actualSpawn(command, patchedArgs, options);
  });

export default mockTurtleSpawn;
