# Codebase Guidelines

This file provides guidance to AI agents when working with code in this repository.

## Project Overview

EAS Build is a cloud-based build system for Expo/React Native applications. This monorepo contains libraries used by the EAS Build service to process Android and iOS builds, supporting both traditional builds and custom builds with user-defined workflows.

## Development Commands

### Setup

```bash
yarn && yarn start              # Install dependencies and start development mode
yarn build                      # Build all packages (required for interdependencies)
```

### Development Workflow

```bash
yarn start                      # Watch mode for all packages (parallel)
yarn watch                      # Same as start
yarn build                 # Build all packages
```

### Testing

```bash
yarn test                       # Run tests for all packages
yarn test:coverage              # Run tests with coverage
yarn test --scope=@expo/build-tools  # Run tests for specific package
```

For a single package (which is usually more convenient), you can also:

```bash
cd packages/build-tools
yarn test                       # Run tests in this package
yarn test --watch              # Watch mode
yarn test path/to/test.test.ts # Run specific test file
```

### Linting

```bash
yarn lint                       # Lint all packages
yarn lint --fix                 # Lint all packages and fix the lint issues
```

### Local Build Testing

Set up environment variables for testing local builds:

```bash
export EAS_LOCAL_BUILD_PLUGIN_PATH=$HOME/expo/eas-build/bin/eas-cli-local-build-plugin
export EAS_LOCAL_BUILD_WORKINGDIR=$HOME/expo/eas-build-workingdir
export EAS_LOCAL_BUILD_SKIP_CLEANUP=1
export EAS_LOCAL_BUILD_ARTIFACTS_DIR=$HOME/expo/eas-build-workingdir/results

# Then run build with --local flag in eas-cli
eas build --local
```

### Releasing

```bash
yarn release                    # Release new version (runs on GHA)
```

## Monorepo Architecture

This is a Lerna-based monorepo.

### Core Packages

**@expo/eas-build-job** - The foundation that all other packages depend on

- Defines all data structures for build operations (Job, BuildPhase, BuildMode, Platform, Workflow)
- Provides type definitions and validation schemas (Zod, Joi)
- Contains BuildPhase enum that defines the traditional build pipeline stages
- Key exports: `Job`, `BuildPhase`, `BuildMode`, `BuildTrigger`, `Workflow`, `ArchiveSource`

**@expo/build-tools** - The main build execution engine

- Orchestrates all build operations through `BuildContext<T extends Job>`
- Contains platform-specific builders: `androidBuilder()`, `iosBuilder()`, `runCustomBuildAsync()`
- Manages build phases, artifact uploading, caching, credentials
- Provides functions for custom builds
- Integrates with GraphQL API

**@expo/steps** - Custom build workflow engine (ESM module)

- Framework for defining and executing custom build steps
- Key abstractions:
  - `BuildWorkflow`: Orchestrates sequential step execution
  - `BuildStep`: Individual executable unit with inputs/outputs
  - `BuildStepGlobalContext`: Manages shared state and interpolation
  - `BuildStepContext`: Per-step execution context
- Supports conditional execution with `if` expressions (using jsep)
- Template interpolation: `${{ steps.step-id.outputs.outputName }}`
- Parses build configs from YAML/JSON

**eas-cli-local-build-plugin** - Local build execution

- Allows running EAS builds locally on developer machines
- Entry point: `packages/local-build-plugin/src/index.ts`
- Sets `EAS_BUILD_RUNNER=local-build-plugin` environment variable
- Reuses all build-tools logic for consistency with cloud builds

### Supporting Packages

**@expo/logger** - Bunyan-based structured logging (used by all packages)
**@expo/downloader** - HTTP file downloading with retry logic
**@expo/turtle-spawn** - Child process spawning with error handling
**@expo/template-file** - Lodash-based template string interpolation
**create-eas-build-function** - CLI scaffolding tool for custom build functions
**template-file** - Simple template file utility

## Key Architectural Patterns

### Build Phases

Most traditional build operations are wrapped in phases for tracking:

```typescript
await ctx.runBuildPhase(BuildPhase.INSTALL_DEPENDENCIES, async () => {
  // Phase logic here
});
```

Phases can be marked as skipped, warning, or failed for granular reporting.

### Context Objects

- **BuildContext** (`build-tools`): For traditional builds, wraps Job, manages phases/artifacts/caching
- **CustomBuildContext** (`build-tools`): Implements `ExternalBuildContextProvider`, bridges BuildContext to steps framework, used in custom builds and generic jobs
- **BuildStepGlobalContext** (`steps`): Manages step outputs, interpolation, shared state
- **BuildStepContext** (`steps`): Per-step context with working directory and logger

### Custom Build Steps

Steps are defined with:

- `id`: Unique identifier
- `name`: Display name
- `run`: Command or function reference
- `if`: Optional condition (`${{ always() }}`, `${{ success() }}`, etc.)
- `inputs`: Key-value inputs to the step
- `outputs`: Named outputs accessible to later steps

Built-in step functions are in `packages/build-tools/src/steps/functions/`

### Conditional Execution

Uses jsep for expression evaluation:

```yaml
if: ${{ steps.previous_step.outputs.success == 'true' && env.ENVIRONMENT == 'production' }}
```

### Artifact Management

Artifacts tracked as `ArtifactToUpload`:

- Managed artifacts (APK, IPA, AAB) with specific handling
- Generic artifacts for any file
- Upload via `ctx.uploadArtifact()` or `upload-artifact` step

## Package Interdependencies

```
eas-cli-local-build-plugin → @expo/build-tools → @expo/eas-build-job
                           ↘                   ↗ @expo/steps
                             @expo/turtle-spawn
```

Most packages depend on `@expo/eas-build-job` as the source of truth for types.

## Common Development Scenarios

### Adding a Built-in Step Function

1. Create file in `packages/build-tools/src/steps/functions/yourFunction.ts`
2. Export `createYourFunctionBuildFunction()` following existing patterns
3. Add to `getEasFunctions()` in `packages/build-tools/src/steps/functions/easFunctions.ts`
4. Function receives `BuildStepContext` and input/output maps

### Adding Error Detection

1. Add pattern detection in `packages/build-tools/src/buildErrors/detectError.ts`
2. Implement resolver for better error messages
3. Helps users understand and fix build failures

### Working with Platform-Specific Builders

- **Android builder** (`packages/build-tools/src/builders/android.ts`): Gradle-based, handles APK/AAB generation, also see `functionGroups/build.ts`
- **iOS builder** (`packages/build-tools/src/builders/ios.ts`): Fastlane/Xcode-based, handles IPA generation, also see `functionGroups/build.ts`
- Both use `runBuilderWithHooksAsync()` which runs build result hooks (on-success, on-error, on-complete) from package.json

## Testing Strategy

- Unit tests with Jest in each package
- Integration tests for build-tools and steps packages
- Mock filesystem (memfs) for testing file operations
- Mock git operations for testing checkout scenarios
- Run tests before submitting PRs

## Environment Requirements

Node and Yarn versions are managed by Volta.
