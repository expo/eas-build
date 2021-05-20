import { fs } from 'memfs';

// `temp-dir` dependency of `tempy` is using `fs.realpathSync('/tmp')`
// on import to verify existence of tmp directory
fs.mkdirSync('/tmp');
if (process.env.TMPDIR) {
  fs.mkdirSync(process.env.TMPDIR, { recursive: true });
}

module.exports = fs;
