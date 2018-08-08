printenv
nvm install 8
nvm use 8

# first, install and build server
cd
wget http://johnvansickle.com/ffmpeg/releases/ffmpeg-release-64bit-static.tar.xz -O ffmpeg.tar.gz
wget http://www.rarlab.com/rar/rarlinux-x64-5.3.0.tar.gz -O rar.tar.gz
cd bin
tar -xvf ../ffmpeg.tar.gz --strip 1 --no-anchored ffmpeg ffprobe
tar -xvf ../rar.tar.gz --strip 1
cd ..
export PATH=$(pwd)/bin:$PATH
wget https://github.com/vpdb/server/archive/master.zip
unzip -e master.zip
cd server-master
npm install
tsc
mkdir -p data/storage-test-protected
mkdir -p data/storage-test-public
node build/app/index.js &
cd ../clone

# build website
npm install
npm run build:browserstack

# start server with static website hosting enabled (config in env)
cd ../server-master
node build/app/index.js &
cd ../clone

# setup browserstack
wget https://www.browserstack.com/browserstack-local/BrowserStackLocal-linux-x64.zip
unzip BrowserStackLocal-linux-x64.zip
./BrowserStackLocal $BROWSERSTACK_KEY --force-local &

# print versions
echo "node version: $(node --version)"
echo "npm version: $(npm --version)"
echo "ffmpeg version: $(ffmpeg -version)"

# wait for server to spin up
sleep 5
echo 'npm run test:browserstack' > run.sh
echo 'err=$?' >> run.sh
echo 'echo Done, uploading report to results.vpdb.io...' >> run.sh
echo 'ssh codeship@results.vpdb.io "rm /home/codeship/results.vpdb.io/*"' >> run.sh
echo 'scp -r report/* codeship@results.vpdb.io:/home/codeship/results.vpdb.io/' >> run.sh
echo 'echo All done!' >> run.sh
echo 'exit $err' >> run.sh
chmod 755 run.sh