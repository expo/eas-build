import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from '../../BuildStepContext.js';

import { createMockLogger } from './logger.js';

export function createMockContext(): BuildStepContext {
  return new BuildStepContext(uuidv4(), createMockLogger(), false);
}
