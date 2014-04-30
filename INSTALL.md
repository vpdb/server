# VPDB Production Setup

## Install Ubuntu

Get Ubuntu 14.04 Server from [here](http://www.ubuntu.com/download/server). Start up
VirtualBox or VMWare and install Ubuntu using the downloaded ISO as installation
medium.

Make sure you enable OpenSSH. Once done, login and update the system:

	sudo apt-get update
	sudo apt-get -y upgrade

## Get Deps

### General Stuff

	sudo apt-get -y install rcconf git-core python-software-properties vim

### Node.js

	sudo add-apt-repository ppa:chris-lea/node.js
	sudo apt-get -y update
	sudo apt-get -y install nodejs

Upgrade ``npm`` to latest and prevent self-signed certificate error

    sudo npm config set ca ""
    sudo npm install -g npm

#### Node Deps

	sudo npm install -g naught

### GraphicsMagick

	sudo apt-get -y install graphicsmagick

### MongoDB

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

## Create Node.js Startup Scripts

	sudo vi /etc/init/vpdb-staging.conf

Paste this:

```bash
description "Start and stop node-vpdb"
author "freezy"

# Configuration
env APP_NAME=vpdb-staging
env APP_ROOT=/var/www/staging
env APP_HOME=/var/www/staging/current
env PORT=8124

# Node Environment is production
env NODE_ENV=production
env ENV=production

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
    test -e $APP_ROOT/shared/logs || { stop; exit 0; }
    test -e $APP_HOME/app.js || { stop; exit 0; }
end script

# cd to code path and run naught
script
    echo Starting staging server for VPDB at ${APP_HOME}...
    chdir $APP_HOME
    exec sudo -u $RUN_AS_USER /usr/bin/naught start --ipc-file $APP_ROOT/shared/naught.ipc --log $APP_ROOT/shared/logs/naught --stdout $APP_ROOT/shared/logs/$APP_NAME.out --stderr $APP_ROOT/shared/logs/$APP_NAME.err --max-log-size 10485760 --cwd . --daemon-mode false app.js
end script
```

Then do the same for the production script:

	sudo cp /etc/init/vpdb-staging.conf /etc/init/vpdb-production.conf
	sudo vi /etc/init/vpdb-production.conf

And update:
* ``env APP_NAME=vpdb-production``
* ``env APP_ROOT=/var/www/production``
* ``env APP_HOME=/var/www/production/current``
* ``env PORT=9124``

## Setup Push Deployment

For client documentation, check the [deployment guide](DEPLOY.md).

### Create file structure

	sudo mkdir -p /var/www/production/shared/logs /var/www/staging/shared/logs
	sudo mkdir -p /repos/production /repos/staging

	sudo chmod 770 /var/www/production /var/www/staging -R
	sudo chmod 700 /repos/production /repos/staging

### Create deployment user

	sudo useradd deployer -d /repos -s /bin/bash -g www-data
	sudo chown deployer:www-data /var/www /repos -R

	sudo su - deployer
	mkdir .ssh
	chmod 700 .ssh
	vi .ssh/authorized_keys

Paste your pub key in there.

Then, add ``naught`` sudo permission to user ``deployer``

	su -
	chmod u+r /etc/sudoers
	echo "# Allow deployer to use naught as root" >> /etc/sudoers
	echo "Cmnd_Alias NAUGHT_CMD = /usr/bin/naught" >> /etc/sudoers
	echo "deployer ALL=(ALL) NOPASSWD: NAUGHT_CMD" >> /etc/sudoers
	chmod u-r /etc/sudoers
	exit

### Setup bare Git repositories

Still as user ``deployer``:

	cd ~/staging && git init --bare
	cd ~/production && git init --bare

Setup deployment hooks:

	cd /tmp
	git clone https://github.com/freezy/node-vpdb.git
	cd node-vpdb/server/hooks
	cp post-receive-production ~/production/hooks/post-receive
	cp post-receive-staging ~/staging/hooks/post-receive
	cp common ~/production/hooks
	cp common ~/staging/hooks

### Upload Code

Push the code to the server as described [here](DEPLOY.md). Then you can start the services:

	su -
	start vpdb-staging
	start vpdb-production

## Links

* [DIY Node.js Server on Amazon EC2](http://cuppster.com/2011/05/12/diy-node-js-server-on-amazon-ec2/)
* [10 steps to nodejs nirvana in production](http://qzaidi.github.io/2013/05/14/node-in-production/)
* [The 4 Keys to 100% Uptime With Node.js](http://engineering.spanishdict.com/blog/2013/12/20/the-4-keys-to-100-uptime-with-nodejs)
* [visionmedia/deploy](https://github.com/visionmedia/deploy/blob/master/bin/deploy)
* [Stagecoach Ubuntu installer](https://github.com/punkave/stagecoach/blob/master/sc-proxy/install-node-and-mongo-on-ubuntu.bash)


