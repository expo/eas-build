# AGENTS.md

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
lerna run build                 # Build all packages
```

### Testing

```bash
yarn test                       # Run tests for all packages
yarn test:coverage              # Run tests with coverage
lerna run test --scope=@expo/build-tools  # Run tests for specific package
```

For a single package, you can also:

```bash
cd packages/build-tools
yarn test                       # Run tests in this package
yarn test --watch              # Watch mode
yarn test path/to/test.test.ts # Run specific test file
```

### Linting

```bash
yarn lint                       # Lint all packages
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

After release, tag the version for EAS CLI:

```bash
npm dist-tag add eas-cli-local-build-plugin@VERSION eas-cli
```

## Monorepo Architecture

This is a Lerna-based monorepo with 10 packages. Understanding the package hierarchy is crucial:

### Core Packages

**@expo/eas-build-job** - The foundation that all other packages depend on

- Defines all data structures for build operations (Job, BuildPhase, BuildMode, Platform, Workflow)
- Provides type definitions and validation schemas (Zod, Joi)
- Contains 45+ BuildPhase enum values that define the build pipeline stages
- Key exports: `Job`, `BuildPhase`, `BuildMode`, `BuildTrigger`, `Workflow`, `ArchiveSource`

**@expo/build-tools** - The main build execution engine

- Orchestrates all build operations through `BuildContext<T extends Job>`
- Contains platform-specific builders: `androidBuilder()`, `iosBuilder()`, `runCustomBuildAsync()`
- Manages build phases, artifact uploading, caching, credentials
- Provides 35+ built-in step functions for custom builds
- Integrates with GraphQL API for EAS communication
- Location: `packages/build-tools/src`

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

## Build Execution Flow

Understanding the build flow is essential for working with this codebase:

1. **Job Definition** arrives (from EAS API or local CLI)
2. **Validation** using eas-build-job schemas
3. **BuildContext creation** wraps the job
4. **Builder selection** based on platform and build mode
5. **Execution path**:
   - **Traditional builds**: Setup → Install deps → Prebuild → Gradle/Fastlane → Upload artifacts
   - **Custom builds**: Prepare sources → Parse config → Execute steps → Upload artifacts
6. **Hooks execution** (npm/yarn scripts in package.json: `eas-build-pre-install`, `eas-build-post-install`, `eas-build-on-success`, `eas-build-on-error`, `eas-build-on-complete`)
7. **Artifact upload** to GCS/R2
8. **Status reporting** back to API

## Key Architectural Patterns

### Build Phases

All build operations are wrapped in phases for tracking:

```typescript
await ctx.runBuildPhase(BuildPhase.INSTALL_DEPENDENCIES, async () => {
  // Phase logic here
});
```

Phases can be marked as skipped, warning, or failed for granular reporting.

### Context Objects

- **BuildContext** (`build-tools`): For traditional builds, wraps Job, manages phases/artifacts/caching
- **CustomBuildContext** (`build-tools`): Implements `ExternalBuildContextProvider`, bridges BuildContext to steps framework
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
if: ${{ steps.previous-step.outputs.success == 'true' && env.ENVIRONMENT == 'production' }}
```

### Artifact Management

Artifacts tracked as `ArtifactToUpload`:

- Managed artifacts (APK, IPA, AAB) with specific handling
- Generic artifacts for any file
- Upload via `ctx.uploadArtifact()` or `upload-artifact` step

## Important Constraints

### Breaking Changes to @expo/eas-build-job

If you need to introduce breaking changes to `@expo/eas-build-job`:

1. Contact CODEOWNERS first
2. Coordinate with backend team to support both old and new formats
3. Deploy changes in phases: API support → publish package → implement logic
4. Example: Adding a required field needs default values for legacy requests

### Updating local-build-plugin in EAS CLI

1. Run `yarn release`
2. Update `eas-build-job` package in EAS CLI if breaking changes
3. Tag version: `npm dist-tag add eas-cli-local-build-plugin@VERSION eas-cli`
4. Publish new EAS CLI version (uses fixed version based on `eas-cli` tag)

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

- **Android builder** (`packages/build-tools/src/builders/android.ts`): Gradle-based, handles APK/AAB generation
- **iOS builder** (`packages/build-tools/src/builders/ios.ts`): Fastlane/Xcode-based, handles IPA generation
- Both use `runBuilderWithHooksAsync()` which runs build result hooks (on-success, on-error, on-complete) from package.json

## Testing Strategy

- Unit tests with Jest in each package
- Integration tests for build-tools and steps packages
- Mock filesystem (memfs) for testing file operations
- Mock git operations for testing checkout scenarios
- Run tests before submitting PRs

## Environment Requirements

- Node.js >= 18 (Volta managed: Node 20.14.0, Yarn 1.22.22)
- Package manager: Yarn 1.22.22 (specified in packageManager field)
- TypeScript 5.5.4
