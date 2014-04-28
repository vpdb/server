# VPDB Production Setup

## Install Ubuntu

Get Ubuntu 14.04 Server from [here](http://www.ubuntu.com/download/server). Start up
VirtualBox or VMWare and install Ubuntu using the downloaded ISO as installation
medium.

Make sure you enable OpenSSH. Once done, login and update the system:

	sudo apt-get update
	sudo apt-get -y upgrade

## Get Deps

Manage services, build tools.

	sudo apt-get install rcconf build-essential libssl-dev git-core

Install Node.js

	mkdir ~/src
	cd ~/src
	wget http://nodejs.org/dist/node-latest.tar.gz
	tar xzf node-latest.tar.gz
	cd node-v*
	./configure --prefix=/usr
	make
	sudo make install

VPDB deps:

	sudo apt-get install graphicsmagick

## Setup Reverse Proxy

	sudo apt-get install nginx

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

```Shell
description "Start and stop node-vpdb"
author "freezy"

env APP_NAME=vpdb
env APP_HOME=/var/www/vpdb/releases/current

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


## Checkout Code

	sudo mkdir /var/www -p
	cd /var/www
	sudo git clone https://github.com/freezy/node-vpdb.git vpdb
	sudo chown `whoami`:`whoami` vpdb -R
	sudo chmod 700 vpdb







## Credits

Useful resources:

* [DIY Node.js Server on Amazon EC2](http://cuppster.com/2011/05/12/diy-node-js-server-on-amazon-ec2/)

