#!/bin/bash
set -euo pipefail
IFS=$'\n\t'

cd ${TRAVIS_BUILD_DIR}
bash src/travis-ci/fetch-firefox.sh release-linux64-add-on-devel
FIREFOX_INSTALL_DIR=${TRAVIS_BUILD_DIR}/firefox/
cd ./dist && \
for xpi in $(ls *.xpi); do \
echo "Installing ${xpi}..." && \
xpi_uuid=$(unzip -qc ${xpi} install.rdf | xmlstarlet sel \
  -N rdf=http://www.w3.org/1999/02/22-rdf-syntax-ns# \
  -N em=http://www.mozilla.org/2004/em-rdf# \
  -t -v \
  "//rdf:Description[@about='urn:mozilla:install-manifest']/em:id") && \
echo "  Installing ${xpi} -> ${FIREFOX_INSTALL_DIR}/extensions/${xpi_uuid}.xpi" && \
mkdir -p ${FIREFOX_INSTALL_DIR}/extensions || true && \
cp ${xpi} ${FIREFOX_INSTALL_DIR}/extensions/${xpi_uuid}.xpi; \
done && \

set -x
echo "Modifying firefox defaults to suit our needs into ${FIREFOX_INSTALL_DIR}..."
tar --directory ${TRAVIS_BUILD_DIR}/docker/root/usr/lib/firefox/ cf - ./ | tar --directory ${FIREFOX_INSTALL_DIR} xf -

sh -e /etc/init.d/xvfb start
${FIREFOX_INSTALL_DIR}/firefox -foreground -no-remote -print https://google.com -print-mode pdf -print-file /tmp/test1.pdf
uuencode /tmp/test1.pdf
exit 0
