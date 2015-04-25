#!/bin/bash

# This is just for reference what you'd configure at Codeship.
nvm install 0.10.25
nvm use 0.10.25
npm install

# deps
wget http://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz
mkdir -p bin
cd bin
tar -xvf ../ffmpeg-release-64bit-static.tar.xz --strip 1 --no-anchored ffmpeg ffprobe
cd ..
export PATH=$(pwd)/bin:$PATH
echo "node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "ffmpeg version: $(ffmpeg -version)"

# Install grunt-cli for running your tests or other tasks
npm install grunt-cli
grunt git
