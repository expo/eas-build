import { fs } from 'memfs';

fs.mkdirSync('/tmp');
if (process.env.TMPDIR) {
  fs.mkdirSync(process.env.TMPDIR, { recursive: true });
}

const fsRealpath = fs.realpath;
(fsRealpath as any).native = fsRealpath;

module.exports = { ...fs, realpath: fsRealpath };
