#!/bin/bash

# Stop on error
set -e

# Install dependencies
echo travis_fold:start:npm-install
npm install -g pngquant-bin
npm install
echo travis_fold:end:npm-install

# Print versions
echo travis_fold:start:Versions
echo "node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "ffmpeg version: $(ffmpeg -version)"
echo "pngquant version: $(pngquant --version)"
echo travis_fold:end:Versions

# Run tests
npm run test:ci