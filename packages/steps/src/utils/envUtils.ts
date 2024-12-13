export function fixEscapeCharactersInRawEnvValue(rawValue: string): string {
  const escapeCharsMatches = rawValue.match(/\\(\w)/g);
  let updatedValue = rawValue;
  for (const match of escapeCharsMatches ?? []) {
    if (match[1] === 'n') {
      updatedValue = updatedValue.replace(`${match[0]}${match[1]}`, '\n');
    }
    if (match[1] === 't') {
      updatedValue = updatedValue.replace(`${match[0]}${match[1]}`, '\t');
    }
    if (match[1] === 'r') {
      updatedValue = updatedValue.replace(`${match[0]}${match[1]}`, '\r');
    }
  }

  return updatedValue;
}
