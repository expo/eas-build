import { fs } from 'memfs';

// `temp-dir` dependency of `tempy` is using `fs.realpathSync('/tmp')`
// on import to verify existence of tmp directory
fs.mkdirSync('/tmp');

module.exports = fs;
