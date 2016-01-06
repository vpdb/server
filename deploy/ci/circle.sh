#!/bin/bash

sudo apt-get -y purge ffmpeg unrar
sudo apt-get -y install graphicsmagick pngquant optipng
wget http://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz -O /tmp/ffmpeg.tar.gz
wget http://www.rarlab.com/rar/rarlinux-x64-5.3.0.tar.gz -O /tmp/rar.tar.gz
mkdir -p  ~/bin
cd ~/bin
tar -xvf /tmp/ffmpeg.tar.gz --strip 1 --no-anchored ffmpeg ffprobe
tar -xvf /tmp/rar.tar.gz --strip 1
export PATH=~/bin:$PATH
cd -

echo "node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "which ffmpeg: $(which ffmpeg)"
echo "ffmpeg version: $(ffmpeg -version)"
echo "pngquant version: $(pngquant --version)"

sudo npm install -g grunt-cli
npm install
grunt git

grunt ci
