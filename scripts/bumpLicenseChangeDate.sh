#!/usr/bin/env bash

ROOT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )"/.. && pwd )"

get_timestamp() {
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo $(date -u -d $1 +%s)
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo $(date -j -f "%Y-%m-%d" "$1" "+%s")
  else
    print "Unsupported OS ($OSTYPE)"
    exit 1
  fi
}

format_timestamp() {
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo $(date -u -d @$1 +%Y-%m-%d)
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo $(date -r $1 +%Y-%m-%d)
  else
    print "Unsupported OS ($OSTYPE)"
    exit 1
  fi
}

DATE_FROM_LICENSE=$(grep "Change Date:" $ROOT_DIR/LICENSE | awk -F ' ' '{print $3}')
TIMESTAMP_FROM_LICENSE=$(get_timestamp $DATE_FROM_LICENSE)
TIMESTAMP_NOW=$(date -u +%s)

# When updating "Change Date" will be set to three years into the future
CHANGE_PERIOD=94608000 # 3 * 365 * 24 * 60 * 60
# Update will happen only if new "Change Date" is at least three months after current one
# It's inteded to minimize amount of updates
UPDATE_PERIOD=7776000 # 3 * 30 * 24 * 60 * 60


if (( $TIMESTAMP_NOW + $CHANGE_PERIOD - $UPDATE_PERIOD > $TIMESTAMP_FROM_LICENSE )) ; then
  echo "Updating \"Change Date\" in LICENSE file"
  NEW_CHANGE_DATE_TIMESTAMP=$(($TIMESTAMP_NOW + $CHANGE_PERIOD))
  NEW_CHANGE_DATE=$(format_timestamp $NEW_CHANGE_DATE_TIMESTAMP)
  SPACES="          "
  PATTERN="s/^Change Date:$SPACES[0-9-]+$/Change Date:$SPACES$NEW_CHANGE_DATE/"
  if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    sed -i -E "$PATTERN" $ROOT_DIR/LICENSE
  elif [[ "$OSTYPE" == "darwin"* ]]; then
    sed -i '' -E "$PATTERN" $ROOT_DIR/LICENSE
  else
    print "Unsupported OS ($OSTYPE)"
    exit 1
  fi
  echo "\"Change Date\" updated to $NEW_CHANGE_DATE"
  echo "Make sure to commit those changes"
fi
