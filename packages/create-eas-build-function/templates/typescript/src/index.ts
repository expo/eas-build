import { BuildStepContext } from '@expo/steps';

// interface FunctionInputs {
//   // specify the type of the inputs value and whether they are required here
//   // example: name: BuildStepInput<BuildStepInputValueTypeName.STRING, true>;
// }

// interface FunctionOutputs {
//   // specify the function outputs and whether they are required here
//   // example: name: BuildStepOutput<true>;
// }

async function myFunction(
  ctx: BuildStepContext
  // {
  //   inputs,
  //   outputs,
  //   env,
  // }: {
  //   inputs: FunctionInputs;
  //   outputs: FunctionOutputs;
  //   env: BuildStepEnv;
  // }
): Promise<void> {
  ctx.logger.info('Hello from my TypeScript function!');
}

export default myFunction;
