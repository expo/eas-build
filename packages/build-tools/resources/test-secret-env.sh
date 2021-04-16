#!/usr/bin/env bash

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
ROOT_DIR="$( cd "$DIR/../../../.."  && pwd)"

source $ROOT_DIR/secrets/test-credentials.sh
