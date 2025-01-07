import { fs } from 'memfs';

fs.mkdirSync('/tmp', { recursive: true });
if (process.env.TMPDIR) {
  fs.mkdirSync(process.env.TMPDIR, { recursive: true });
}

const fsRealpath = fs.realpath;
(fsRealpath as any).native = fsRealpath;

const fsRm = (path: string, options: object): Promise<void> => {
  return fs.promises.rm(path, options);
};

module.exports = { ...fs.promises, realpath: fsRealpath, rm: fsRm };

// NOTE(cedric): workaround to also mock `node:fs`
jest.mock('node:fs', () => require('fs'));
