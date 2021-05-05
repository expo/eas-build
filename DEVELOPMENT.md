## Contributing to EAS Build

### Development process

#### Setting up your environment

- Install eas-cli (either from npm or use locally cloned repository)
- Run `yarn && yarn start` in root of the repository
- Test your changes by running build with flag `--local`

You can use below script to simplify devleopment process. `./path/to/script build --local`

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

If you want to intruduce breaking changes to the `@expo/eas-build-job` package contact one of the [CODEOWNERS](/CODEOWNERS), so we can make sure that legacy cases are still suported on EAS build servers and in GraphQL API. Please describe what changes you want to make and why and we will implement api changes that support both cases. After everything is deployed to production you can introduce PR that relies on the new implementation.


Change like that could be e.g. introducing new required field in job object. In that case we would make changes to allow this field and provide default values for legacy requests, but it would be ignored by build process. After everything is deployed/published your follow up PR would introduce logic that is using this new field.
