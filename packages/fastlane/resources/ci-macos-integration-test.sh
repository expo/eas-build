#!/usr/bin/env bash

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PACKAGE_DIR="$( cd "$DIR/.."  && pwd)"
ROOT_DIR="$( cd "$DIR/../../../.."  && pwd)"

pushd $PACKAGE_DIR  >/dev/null 2>&1
echo "no tests found" || ./resources/jest --runInBand --config jest.ci-macos.config.integration.js
popd >/dev/null 2>&1
