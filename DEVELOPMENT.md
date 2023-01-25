## Contributing to EAS Build

### Development process

#### Setting up your environment

- Install eas-cli (either from npm or use locally cloned repository)
- Run `yarn && yarn start` in root of the repository
- Test your changes by running build with flag `--local`

You can use the script below to simplify the development process. `./path/to/script build --local`

```
#!/usr/bin/env bash

export EAS_LOCAL_BUILD_PLUGIN_PATH=$HOME/expo/eas-build/bin/eas-cli-local-build-plugin
export EAS_LOCAL_BUILD_WORKINGDIR=$HOME/expo/eas-build-workingdir
export EAS_LOCAL_BUILD_SKIP_CLEANUP=1
export EAS_LOCAL_BUILD_ARTIFACTS_DIR=$HOME/expo/eas-build-workingdir/results

rm -rf $EAS_LOCAL_BUILD_WORKINGDIR
eas "$@" # or $HOME/expo/eas-cli/bin/run "$@"
```

#### Introducing breaking changes for job API (@expo/eas-build-job package)

If you want to introduce breaking changes to the `@expo/eas-build-job` package contact one of the [CODEOWNERS](/CODEOWNERS), so we can make sure that legacy cases are still supported on EAS build servers and in GraphQL API. Please describe what changes you want to make and why and we will implement API changes that support both cases. After everything is deployed to production you can introduce PR that relies on the new implementation.

Change like that could be e.g. introducing a new required field in the job object. In that case, we would make changes to allow this field and provide default values for legacy requests, but it would be ignored by the build process. After everything is deployed/published, your follow-up PR would introduce logic that is using this new field.

### Updating `local-build-plugin` in EAS CLI

- Run `yarn release` (local build plugin will be published as `next`).
- If there are breaking changes, update `eas-build-job` package in EAS CLI and make sure everything works as expected.
- Tag newly published version as `latest` - `npm dist-tag add eas-cli-local-build-plugin@VERSION latest`.
- Publish a new EAS CLI version. EAS CLI uses a fixed version of the `eas-cli-local-build-plugin` package, the version is set based on `latest` tag at the publish time.
