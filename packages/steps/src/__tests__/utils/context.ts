import { v4 as uuidv4 } from 'uuid';

import { BuildStepContext } from '../../BuildStepContext';

import { createMockLogger } from './logger';

export function createMockContext(): BuildStepContext {
  return new BuildStepContext(uuidv4(), createMockLogger(), false);
}
