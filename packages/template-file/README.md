# @expo/template-file

`@expo/template-file` provides file-level variable substitution (Mustache template style).

## API

```ts
templateFile(templateContents: string, outputFilePath: string, envs: Record<string, string | number>): Promise<void>
```

## Usage example

```ts
import templateFile from '@expo/template-file';

const templateContents = `
{
  "someKey": {{ ABC }},
  "anotherKey": {{ XYZ }}
}
`;

await templateFile(templateContents, 'abc.json', { ABC: 123, XYZ: 789 });
```

`abc.json` file should be created with the following contents:

```json
{
  "someKey": 123,
  "anotherKey": 789
}
```

## Repository

https://github.com/expo/eas-build/tree/main/packages/template-file
