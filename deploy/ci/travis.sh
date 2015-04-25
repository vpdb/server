#!/bin/bash

# Stop on error
set -e

# Install dependencies
echo travis_fold:start:Dependencies
sudo apt-get update
sudo apt-get -y install graphicsmagick pngquant optipng
sudo wget http://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz
sudo mkdir -p bin
sudo tar xvf ../ffmpeg-release-64bit-static.tar.xz --strip 1 --no-anchored ffmpeg ffprobe
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
grunt coveralls:api