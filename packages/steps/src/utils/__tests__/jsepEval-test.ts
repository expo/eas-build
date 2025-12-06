import { createHash } from 'node:crypto';

import { jsepEvalAsync } from '../jsepEval.js';

const hashStringAsync = async (...value: string[]): Promise<string> => {
  const digest = createHash('sha256');
  for (const v of value) {
    digest.update(v);
  }
  return digest.digest('hex');
};

const TEST_CASES = [
  ['1 + 1', 2],
  ['1 + 3', 4],
  ['1 +3', 4],
  ['"a" + 3', 'a3'],
  ['true', true],
  ['false', false],
  ['!false', true],
  ['"a" !== "b"', true],
  ['"a" === "b"', false],
  ['("a" === "a") && false', false],
  ['("a" === "a") || false', true],
  ['this.missing', undefined],
  ['this["missing"]', undefined],
  ['1 + eas', 2, { eas: 1 }],
  ['1 + eas.jobCount', 10, { eas: { jobCount: 9 } }],
  [
    'success() && env.NODE_ENV === "staging"',
    true,
    { success: () => true, env: { NODE_ENV: 'staging' } },
  ],
  [
    'success() && env.NODE_ENV === "staging"',
    false,
    { success: () => true, env: { NODE_ENV: 'production' } },
  ],
  ['0 == 1 ? "a" : "b"', 'b'],
  ['fromJSON("{\\"a\\": 1}").a', 1, { fromJSON: JSON.parse }],
  ['fromJSON("{\\"a\\": 1}")[fromJSON(\'"a"\')]', 1, { fromJSON: JSON.parse }],
  ['fromJSON(null).a', undefined, { fromJSON: JSON.parse }],
  [
    'hashString(["abc"][0])',
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    { hashString: hashStringAsync },
  ],
  [
    'env.PACKAGER == "bun" ? hashString("package.json", "bun.lockb") : hashString("package.json", "package-lock.json")',
    '43265b153af268a1a2fa679535c0dfdb6c4a2225b65380ff866ee91920ca13df',
    { hashString: hashStringAsync, env: { PACKAGER: 'bun' } },
  ],
  [
    'hashString("abc") + hashString("def")',
    'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015adcb8379ac2098aa165029e3938a51da0bcecfc008fd6795f401178647f96c5b34',
    { hashString: hashStringAsync },
  ],
] as const;

describe(jsepEvalAsync, () => {
  it('works', async () => {
    for (const [expr, expectation, context] of TEST_CASES) {
      expect(await jsepEvalAsync(expr, context)).toBe(expectation);
    }
  });
});
