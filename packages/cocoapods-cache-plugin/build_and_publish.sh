#!/usr/bin/env bash

set -eo pipefail
set -x

COCOAPODS_CACHE_PLUGIN_DIR=$( dirname "${BASH_SOURCE[0]}" )

OUTPUT_FILE=$1

if [[ -z "$OUTPUT_FILE" ]]; then
  echo "Please specify the output file (.gem)"
  echo "Usage: ./build.sh OUTPUT_FILE"
  echo "Example: ./build.sh cocoapods-cache-plugin.gem"
  exit -1
fi

if [[ "$OUTPUT_FILE" != *.gem ]]; then
  OUTPUT_FILE="$OUTPUT_FILE.gem"
fi

echo "Building $OUTPUT_FILE"

target_dir=$(mktemp -d)

cp -r $COCOAPODS_CACHE_PLUGIN_DIR $target_dir

gem_name="cocoapods-cache-plugin.gem"

pushd $target_dir >/dev/null 2>&1
gem build cocoapods-cache-plugin.gemspec --output=$gem_name --silent
popd >/dev/null 2>&1

cp "$target_dir/$gem_name" "$OUTPUT_FILE"

echo "Gem is ready: $OUTPUT_FILE"

rm -rf $target_dir

echo "Publishing the gem"

gem push $OUTPUT_FILE

echo "Done"
