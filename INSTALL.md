# VPDB Production Setup

## Install Ubuntu

Get Ubuntu 14.04 Server from [here](http://www.ubuntu.com/download/server). Start up
VirtualBox or VMWare and install Ubuntu using the downloaded ISO as installation
medium.

Make sure you enable OpenSSH. Once done, login and update the system:

	sudo apt-get update
	sudo apt-get -y upgrade

## Get Deps

### General Stuff.

	sudo apt-get -y install rcconf git-core python-software-properties vim

### Node.js

	sudo add-apt-repository ppa:chris-lea/node.js
	sudo apt-get -y update
	sudo apt-get -y install nodejs

Upgrade ``npm`` to latest and prevent self-signed certificate error

    sudo npm config set ca ""
    sudo npm install -g npm

### GraphicsMagick:

	sudo apt-get -y install graphicsmagick

### MongoDB:

Install 2.6 from repo:

	sudo apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10
	su -
	echo "deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen" >> /etc/apt/sources.list
	exit
	sudo apt-get -y update
	sudo apt-get install -y mongodb-org

Configure correctly. Also open `/etc/mongod.conf` and check that ``bind_ip = 127.0.0.1`` is in there.

	su -
	echo "smallfiles = true" >> /etc/mongod.conf

Paste this at the end of ``/etc/init/mongod.conf``:

	# Make sure we respawn if the physical server
	# momentarily lies about disk space, but also
	# make sure we don't respawn too fast

	post-stop script
	  sleep 5
	end script
	respawn

Restart and go back to normal user:

	stop mongodb
    start mongodb
	exit


## Setup Reverse Proxy

	sudo apt-get -y install nginx

Edit the **nginx** default configuration file replacing the root (/) location section:

	sudo vi /etc/nginx/sites-enabled/default

Use a proxy passengry entry. This will forward your requests to your node server.

	location / {
		proxy_pass http://127.0.0.1:8124/;
	}


Then restart nginx:

	sudo /etc/init.d/nginx restart

### Test

	mkdir ~/www-test
	cd ~/www-test
	cat > server.js

	var http = require('http');
	http.createServer(function (req, res) {
		res.writeHead(200, {'Content-Type': 'text/plain'});
		res.end('Hello World\n');
	}).listen(8124, "127.0.0.1");
	console.log('Server running at http://127.0.0.1:8124/');

Start and test:

	node server.js

Open browser with the VM's IP address and make sure you'll get a "Hello World". If all good,
``Ctrl+C`` node and remove the test folder.

	cd ~
	rm www-test -r

## Create Node.js Startup Script

	sudo vi /etc/init/node-vpdb.conf

Paste this:

```bash
description "Start and stop node-vpdb"
author "freezy"

env APP_NAME=vpdb
env APP_HOME=/var/www/vpdb/releases/current

env RESTARTFILE=/var/run/node-vpdb
env ENV=production
env PORT=8124

# Node Environment is production
env NODE_ENV=production
# User to run as
env RUN_AS_USER=www-data

# Make sure network and fs is up, and start in runlevels 2-5
start on (net-device-up
          and local-filesystems
          and runlevel [2345])
# Stop in runlevels 0,1 and 6
stop on runlevel [016]

# automatically respawn, but if its respwaning too fast (5 times in 60 seconds, don't do that)
respawn
respawn limit 5 60

# make sure node is there, the code directory is there
pre-start script
    test -x /usr/bin/node || { stop; exit 0; }
    test -e $APP_HOME/logs || { stop; exit 0; }
end script

# cd to code path and run node, with the right switches
script
    chdir $APP_HOME
    exec /usr/bin/node server/cluster app.js -u $RUN_AS_USER -l logs/$APP_NAME.out -e logs/$APP_NAME.err >> $APP_HOME/logs/upstart
end script
```

## Setup Deployment

Create deployment user:

	sudo useradd deployer
	sudo touch /var/run/vpdb-production
	sudo touch /var/run/vpdb-staging
	sudo chown deployer:deployer /var/run/vpdb-*
	sudo chmod 644 /var/run/vpdb-*

Create file structure:

	sudo mkdir /var/www/production -p
	sudo mkdir /var/www/staging -p

	sudo chown deployer:deployer /var/www/staging /var/www/production
	sudo chmod 700 /var/www/staging /var/www/production



## Credits

Useful resources:

* [DIY Node.js Server on Amazon EC2](http://cuppster.com/2011/05/12/diy-node-js-server-on-amazon-ec2/)
* [10 steps to nodejs nirvana in production](http://qzaidi.github.io/2013/05/14/node-in-production/)
* [The 4 Keys to 100% Uptime With Node.js](http://engineering.spanishdict.com/blog/2013/12/20/the-4-keys-to-100-uptime-with-nodejs)
* [visionmedia/deploy](https://github.com/visionmedia/deploy/blob/master/bin/deploy)
* [Stagecoach Ubuntu installer](https://github.com/punkave/stagecoach/blob/master/sc-proxy/install-node-and-mongo-on-ubuntu.bash)


