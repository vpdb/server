# VPDB Production Setup

## Tech Stack

* [Ubuntu Server](http://www.ubuntu.com/) or any Debian-based distro as base OS
* [Node.js](http://nodejs.org/) for dynamic page serving
* [Nginx](http://nginx.org/) for static page serving and reverse proxy
* [Git](http://git-scm.com/) for push deployments on client side
* [Upstart](http://upstart.ubuntu.com/) as Node.js service wrapper
* [Naught](https://github.com/andrewrk/naught) for zero downtime code deployment
* [MongoDB](https://www.mongodb.org/) for data storage
* [Redis](http://redis.io/) for session storage

## Install Ubuntu

Get Ubuntu 14.04 Server from [here](http://www.ubuntu.com/download/server). Start up
VirtualBox or VMWare and install Ubuntu using the downloaded ISO as installation
medium.

Make sure you enable OpenSSH. Once done, login and update the system:

	sudo apt-get update
	sudo apt-get -y upgrade

### Setup Firewall

	sudo apt-get -y install iptables-persistent
	cd /etc/iptables
	sudo wget https://gist.githubusercontent.com/jirutka/3742890/raw/c025b0b8c58af49aa9644982c459314c9adba157/rules-both.iptables
	sudo vi rules-both.iptables

Update to your taste, then create symlinks and apply:

	sudo ln -s rules-both.iptables rules.v4
    sudo ln -s rules-both.iptables rules.v6
    sudo service iptables-persistent start

### Harden System Security

[Shared Memory](https://help.ubuntu.com/community/StricterDefaults#Shared_Memory)

	sudo echo "none     /run/shm     tmpfs     defaults,ro     0     0" >> /etc/fstab

[SSH Root Login](https://help.ubuntu.com/community/StricterDefaults#SSH_Root_Login)

	sudo vi /etc/ssh/sshd_config

Set:

	PermitRootLogin no


## Get Deps

### General Stuff

	sudo apt-get -y install rcconf git-core python-software-properties vim

### Node.js

	sudo add-apt-repository ppa:chris-lea/node.js
	sudo apt-get -y update
	sudo apt-get -y install nodejs

Upgrade ``npm`` to latest and prevent self-signed certificate error

    sudo npm config set ca ""
    sudo npm install -g npm grunt-cli

#### Node Deps

	sudo npm install -g andrewrk/naught

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

	stop mongod
    start mongod
	exit

## Create Node.js Startup Scripts

	sudo vi /etc/init/vpdb-staging.conf

Paste this:

```bash
description "Start and stop node-vpdb"
author "freezy"

# Configuration
env APP_NAME=staging
env APP_ROOT=/var/www/staging
env APP_HOME=/var/www/staging/current
env APP_CACHEDIR=/var/www/staging/shared/cache
env APP_ACCESS_LOG=/var/www/staging/shared/logs/access
env PORT=8124

# Application settings
env APP_SETTINGS=/var/www/shared/settings.js

# Node Environment is production
env NODE_ENV=production

# User to run as
setuid www-data
setgid www-data

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
    umask 0007
    exec /usr/bin/naught start --ipc-file $APP_ROOT/shared/naught.ipc --log $APP_ROOT/shared/logs/naught --stdout $APP_ROOT/shared/logs/$APP_NAME.out --stderr $APP_ROOT/shared/logs/$APP_NAME.err --max-log-size 10485760 --cwd $APP_HOME --daemon-mode false $APP_HOME/app.js
end script
```

Then do the same for the production script:

	sudo cp /etc/init/vpdb-staging.conf /etc/init/vpdb-production.conf
	sudo sed -i 's/staging/production/g' /etc/init/vpdb-production.conf
	sudo sed -i 's/8124/9124/g' /etc/init/vpdb-production.conf

## Setup Push Deployment

For client documentation, check the [deployment guide](DEPLOY.md).

### Create file structure

	sudo mkdir -p /var/www/shared
	sudo mkdir -p /var/www/production/shared/logs /var/www/production/shared/cache /var/www/production/shared/data
	sudo mkdir -p /var/www/staging/shared/logs /var/www/staging/shared/cache /var/www/staging/shared/data
	sudo mkdir -p /repos/production /repos/staging

	sudo chmod 770 /var/www/production /var/www/staging /var/www/shared -R
	sudo chmod 700 /repos/production /repos/staging

	sudo ln -s /var/log/upstart/vpdb-production.log /var/www/production/shared/logs/upstart
	sudo ln -s /var/log/upstart/vpdb-staging.log /var/www/staging/shared/logs/upstart


The ``shared`` folder contains the following:

* ``logs`` - Log files from the workers and naught
* ``data`` - User-generated files.
* ``cache`` - Auto-generated files. This folder is cleaned on every deployment.

Note that the deployment files in ``/var/www/[production|staging]/current`` are read-only (and owned by the ``deployer``
user). All data *written* by the app (the ``www-data`` user) goes into either ``cache`` or ``data`` of the ``shared``
folder.

### Create deployment user

	sudo useradd deployer -d /repos -s /bin/bash -g www-data
	sudo chown deployer:www-data /var/www /repos -R
	sudo chown www-data:www-data /var/www/production/shared/cache /var/www/production/shared/data -R
	sudo chown www-data:www-data /var/www/staging/shared/cache /var/www/staging/shared/data -R

	sudo su - deployer
	mkdir .ssh
	chmod 700 .ssh
	vi .ssh/authorized_keys

Paste your pub key in there.

### Setup bare Git repositories

Still as user ``deployer``:

	cd ~/staging
	git init --bare
	git remote add origin https://github.com/freezy/node-vpdb.git
	git fetch

	cd ~/production
	git init --bare
	git remote add origin https://github.com/freezy/node-vpdb.git
	git fetch

Setup deployment hooks:

	cd ~
	git clone https://github.com/freezy/node-vpdb.git source
	ln -s ~/source/deploy/hooks/post-receive-production ~/production/hooks/post-receive
	ln -s ~/source/deploy/hooks/post-receive-staging ~/staging/hooks/post-receive
	ln -s ~/source/deploy/hooks/common ~/production/hooks/common
	ln -s ~/source/deploy/hooks/common ~/staging/hooks/common

## Upload Code

Still as user ``deployer``, create configuration file

	cp server/config/settings-dist.js /var/www/shared/settings.js
	vi /var/www/shared/settings.js

Update and double-check all ``@important`` settings. When done, run

	npm install
	APP_SETTINGS=/var/www/shared/settings.js node server/config/validate.js

Check if your settings are valid. Then push the code to the server as described [here](DEPLOY.md). Of course the code
hot-swap will fail since there isn't anything running yet. However, code should be uploaded at the correct location, and
you can now start the services:

	su -
	start vpdb-staging
	exit

Once VPDB gets a first release tag and you've pushed to production as well, don't forget to launch the service:

	start vpdb-production

## Setup Reverse Proxy

	sudo apt-get -y install nginx nginx-naxsi
	sudo mkdir -p /var/cache/nginx

Generate an SSL certificate:

	su -
	mkdir /etc/nginx/ssl
	chgrp www-data /etc/nginx/ssl
	chmod 770 /etc/nginx/ssl
	cd /etc/nginx/ssl
	openssl genrsa -des3 -out vpdb.key 2048
	openssl req -new -key vpdb.key -out vpdb.csr
	cp -v vpdb.{key,original}
	openssl rsa -in vpdb.original -out vpdb.key
	rm -v vpdb.original
	openssl x509 -req -days 365 -in vpdb.csr -signkey vpdb.key -out vpdb.crt
	exit

Update the configuration and add the sites:

	sudo cp /repos/source/deploy/nginx/nginx.conf /etc/nginx/nginx.conf
	sudo cp /repos/source/deploy/nginx/sites/production /etc/nginx/sites-available/vpdb-production
	sudo cp /repos/source/deploy/nginx/sites/staging /etc/nginx/sites-available/vpdb-staging
	sudo ln -s /etc/nginx/sites-available/vpdb-production /etc/nginx/sites-enabled/vpdb-production
	sudo ln -s /etc/nginx/sites-available/vpdb-staging /etc/nginx/sites-enabled/vpdb-staging
	sudo rm /etc/nginx/sites-enabled/default

Update ``server_name`` to the correct domain:

	sudo vi /etc/nginx/sites-available/vpdb-production
	sudo vi /etc/nginx/sites-available/vpdb-staging

Then restart nginx:

	sudo /etc/init.d/nginx restart

If you want to (temporarily) protect your site:

	sudo apt-get -y install apache2-utils
	sudo htpasswd -c /var/www/shared/.htpasswd vpdb
	sudo chown www-data:www-data /var/www/shared/.htpasswd
	sudo vi /etc/nginx/sites-available/vpdb-staging

Add this to the ``server { ... }`` block

	auth_basic "Restricted";
	auth_basic_user_file /var/www/shared/.htpasswd;


## Links

* [DIY Node.js Server on Amazon EC2](http://cuppster.com/2011/05/12/diy-node-js-server-on-amazon-ec2/)
* [10 steps to nodejs nirvana in production](http://qzaidi.github.io/2013/05/14/node-in-production/)
* [The 4 Keys to 100% Uptime With Node.js](http://engineering.spanishdict.com/blog/2013/12/20/the-4-keys-to-100-uptime-with-nodejs)
* [visionmedia/deploy](https://github.com/visionmedia/deploy/blob/master/bin/deploy)
* [Stagecoach Ubuntu installer](https://github.com/punkave/stagecoach/blob/master/sc-proxy/install-node-and-mongo-on-ubuntu.bash)
* [Hardening Node.js for Production Part 2](http://blog.argteam.com/coding/hardening-node-js-for-production-part-2-using-nginx-to-avoid-node-js-load/)