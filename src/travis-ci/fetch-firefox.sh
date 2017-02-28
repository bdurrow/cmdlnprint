#!/bin/bash
# Copied and slightly modified from https://gist.githubusercontent.com/carlin-q-scott/7d57cb4684fa28c1823169b53997368c/raw/1e070eb98b90bd167f07cce975f13102a9333fad/fetch-firefox.sh
# clarin-g-scott attributed his script thusly
# Copied and slightly modified from https://github.com/lidel/ipfs-firefox-addon/commit/d656832eec807ebae59543982dde96932ce5bb7c
# Licensed under Creative Commons -  CC0 1.0 Universal - https://github.com/lidel/ipfs-firefox-addon/blob/master/LICENSE
BUILD_TYPE=${1:-$FIREFOX_RELEASE}
echo "Looking up latest URL for $BUILD_TYPE"
BUILD_ROOT="/pub/firefox/tinderbox-builds/mozilla-${BUILD_TYPE}/"
ROOT="https://archive.mozilla.org"
LATEST=$(curl -s "$ROOT$BUILD_ROOT" | grep $BUILD_TYPE | sed -nEe 's/^.*<a href=".+">([0-9]+)\/.*$/\1/p' | sort -n | tail -1)
echo "Latest build located at $ROOT$BUILD_ROOT$LATEST"
FILE=$(curl -s "$ROOT$BUILD_ROOT$LATEST/" | sed -nEe 's,^.*<a href="([-_./a-zA-Z0-9]*\.tar\.bz2)\">.*$,\1,p')
echo "URL: $ROOT$FILE"
curl --location -s "$ROOT$FILE" | tar xf -
