#!/bin/bash

# Stop on error
set -e

# Print versions
echo travis_fold:start:Versions
echo "node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "ffmpeg version: $(ffmpeg -version)"
echo travis_fold:end:Versions

# Install dependencies
echo travis_fold:start:npm-install
npm install -g grunt-cli
npm install
echo travis_fold:end:npm-install

# Build application
echo travis_fold:start:grunt-build
grunt git
echo travis_fold:end:grunt-build

# Run tests
grunt ci
grunt coveralls:api