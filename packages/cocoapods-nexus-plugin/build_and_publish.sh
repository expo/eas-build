#!/usr/bin/env bash

set -eo pipefail
set -x

COCOAPODS_NEXUS_PLUGIN_DIR=$( dirname "${BASH_SOURCE[0]}" )

target_dir=$(mktemp -d)

cp -r $COCOAPODS_NEXUS_PLUGIN_DIR $target_dir

GEM_NAME="cocoapods-nexus-plugin.gem"

pushd $target_dir >/dev/null 2>&1
gem build cocoapods-nexus-plugin.gemspec --output=$GEM_NAME --silent
popd >/dev/null 2>&1

cp "$target_dir/$GEM_NAME" "$GEM_NAME"

echo "Gem is ready: $GEM_NAME"

rm -rf $target_dir

echo "Publishing the gem"

gem push $GEM_NAME

echo "Done"
