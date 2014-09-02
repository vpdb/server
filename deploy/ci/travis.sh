#!/bin/bash

# Stop on error
set -e

# Install dependencies
echo travis_fold:start:Dependencies
sudo apt-get update
sudo apt-get -y install graphicsmagick pngquant optipng
sudo wget http://ffmpeg.gusari.org/static/64bit/ffmpeg.static.64bit.latest.tar.gz
sudo mkdir -p bin
cd bin
sudo tar zxf ../ffmpeg.static.64bit.latest.tar.gz
cd ..
export PATH=$(pwd)/bin:$PATH
echo travis_fold:end:Dependencies

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
