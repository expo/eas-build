#!/usr/bin/env bash

set -eo pipefail

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/.. && pwd )"

# TODO: choose the version bump based on the changelog
LERNA_BUMP="${1:-patch}"

pushd $ROOT_DIR >/dev/null 2>&1
lerna version --no-push --exact "$LERNA_BUMP"
popd >/dev/null 2>&1
