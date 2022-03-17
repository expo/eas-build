#!/usr/bin/env bash

for DIR in ./packages/* ; do
  pushd $DIR >/dev/null 2>&1
  echo "[$DIR] yarn $@"
  yarn $@
  popd >/dev/null 2>&1
done
