import path from 'path';

import fs from 'fs-extra';

import { createMockLogger } from '../../__tests__/utils/logger';
import { logEasJsonContents } from '../setup';

jest.mock('fs');

describe(logEasJsonContents, () => {
  it('logs the raw eas.json contents even when it is not valid JSON', async () => {
    const projectDir = '/project';
    const easJsonPath = path.join(projectDir, 'eas.json');
    const contents = "{\n  build: {\n    ios: {\n      image: 'latest'\n    }\n  }\n}\n";

    await fs.mkdirp(projectDir);
    await fs.writeFile(easJsonPath, contents);

    const logger = createMockLogger();
    logEasJsonContents({
      logger,
      getReactNativeProjectDirectory: () => projectDir,
    });

    expect(logger.info).toHaveBeenCalledWith('Using eas.json:');
    expect(logger.info).toHaveBeenCalledWith(contents);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
