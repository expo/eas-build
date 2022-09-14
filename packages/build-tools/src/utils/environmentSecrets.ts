import fs from 'fs';
import path from 'path';

import { v4 as uuid } from 'uuid';

export function createTemporaryEnvironmentSecretFile(secretsDir: string, value: string): string {
  const randomFilePath = path.join(secretsDir, uuid());
  fs.writeFileSync(randomFilePath, Buffer.from(value, 'base64'));
  return randomFilePath;
}
