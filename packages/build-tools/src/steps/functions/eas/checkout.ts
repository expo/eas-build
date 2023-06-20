import { BuildFunction } from '@expo/steps';
import fs from 'fs-extra';

export function createCheckoutBuildFunction(): BuildFunction {
  return new BuildFunction({
    namespace: 'eas',
    id: 'checkout',
    name: 'Checkout',
    fn: async (stepsCtx) => {
      stepsCtx.logger.info('Checking out project directory');
      await fs.move(
        stepsCtx.global.projectSourceDirectory,
        stepsCtx.global.projectTargetDirectory,
        {
          overwrite: true,
        }
      );
    },
  });
}
