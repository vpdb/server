#!/bin/bash

# This is just for reference what you'd configure at Codeship.
nvm install 0.10.25
nvm use 0.10.25
npm install

# deps
wget http://ffmpeg.gusari.org/static/64bit/ffmpeg.static.64bit.latest.tar.gz
mkdir -p bin
cd bin
tar zxf ../ffmpeg.static.64bit.latest.tar.gz
cd ..
export PATH=$(pwd)/bin:$PATH
echo "node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "ffmpeg version: $(ffmpeg -version)"

# Install grunt-cli for running your tests or other tasks
npm install grunt-cli
grunt git
