# VPDB Production Setup

## Tech Stack

* [Ubuntu Server](http://www.ubuntu.com/) or any Debian-based distro as base OS
* [Node.js](http://nodejs.org/) for dynamic page serving
* [Nginx](http://nginx.org/) for static page serving and reverse proxy
* [Git](http://git-scm.com/) for push deployments on client side
* [Upstart](http://upstart.ubuntu.com/) as Node.js service wrapper
* [Naught](https://github.com/andrewrk/naught) for zero downtime code deployment
* [MongoDB](https://www.mongodb.org/) for data storage
* [Redis](http://redis.io/) for message queue, quota and ACLs 

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

Update to your taste (unblock port 80, 443, 8088, 8089), then create symlinks and apply:

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
	sudo npm install -g npm
	sudo npm install -g grunt-cli bower

#### Node Deps

	sudo npm install -g andrewrk/naught

### Image Tools

	sudo apt-get -y install graphicsmagick pngquant
	
OptiPNG needs manual compilation since in Ubuntu's repo there's only an outdated, vulnerable version:

	cd /usr/local/src
	wget http://downloads.sourceforge.net/project/optipng/OptiPNG/optipng-0.7.5/optipng-0.7.5.tar.gz
	tar xvfz optipng-0.7.5.tar.gz 
	cd optipng-0.7.5
	./configure && make
	sudo make install

### Video Tools

FFmpeg was removed from Ubuntu and replaced by Libav. Duh.

	sudo apt-get purge -y libav ffmpeg
	sudo apt-add-repository -y ppa:jon-severinsson/ffmpeg
	sudo apt-get update
	sudo apt-get install -y ffmpeg

### MongoDB

Install 2.6 from repo:

	sudo apt-key adv --keyserver keyserver.ubuntu.com --recv 7F0CEB10
	sudo /bin/bash
	echo "deb http://downloads-distro.mongodb.org/repo/ubuntu-upstart dist 10gen" >> /etc/apt/sources.list
	exit
	sudo apt-get -y update
	sudo apt-get install -y mongodb-org

Configure correctly. Also open `/etc/mongod.conf` and check that ``bind_ip = 127.0.0.1`` is in there.

	sudo /bin/bash
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

### Redis

Install latest from repo:

	sudo apt-add-repository ppa:chris-lea/redis-server
	sudo apt-get update
	sudo apt-get install -y redis-server

## Create Node.js Startup Scripts

	sudo vi /etc/init/vpdb-staging.conf

Paste this:

```bash
description "Visual Pinball Database (staging)"
author "freezy"

# Configuration
env APP_NAME=staging
env APP_ROOT=/var/www/staging
env APP_HOME=/var/www/staging/current
env APP_CACHEDIR=/var/www/staging/shared/cache
env APP_ACCESS_LOG=/var/www/staging/shared/logs/access
env APP_NUMWORKERS=1
env PORT=8124

# Application settings
env APP_SETTINGS=/var/www/staging/settings.js

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
	IPC=$APP_ROOT/shared/naught.ipc
	rm -f $IPC
	exec /usr/bin/naught start --ipc-file $IPC --log $APP_ROOT/shared/logs/naught --stdout $APP_ROOT/shared/logs/$APP_NAME.out --stderr $APP_ROOT/shared/logs/$APP_NAME.err --max-log-size 10485760 --cwd $APP_HOME --daemon-mode false --worker-count $APP_NUMWORKERS $APP_HOME/app.js
end script
```

Then do the same for the production script:

	sudo cp /etc/init/vpdb-staging.conf /etc/init/vpdb-production.conf
	sudo sed -i 's/staging/production/g' /etc/init/vpdb-production.conf
	sudo sed -i 's/8124/9124/g' /etc/init/vpdb-production.conf
	sudo sed -i 's/APP_NUMWORKERS=1/APP_NUMWORKERS=2/g' /etc/init/vpdb-production.conf

## Setup Push Deployment

For client documentation, check the [deployment guide](DEPLOY.md).

### Create file structure

	sudo mkdir -p /var/www/production/shared/logs /var/www/production/shared/cache /var/www/production/shared/data /var/www/production/config
	sudo mkdir -p /var/www/staging/shared/logs /var/www/staging/shared/cache /var/www/staging/shared/data /var/www/staging/config
	sudo mkdir -p /repos/production /repos/staging

	sudo chmod 770 /var/www /var/www/production /var/www/staging -R
	sudo chmod 700 /repos/production /repos/staging

	sudo ln -s /var/log/upstart/vpdb-production.log /var/www/production/shared/logs/upstart
	sudo ln -s /var/log/upstart/vpdb-staging.log /var/www/staging/shared/logs/upstart


The ``shared`` folder contains the following:

* ``logs`` - Log files from the workers and naught
* ``data`` - User-generated files.
* ``cache`` - Auto-generated files.

Note that the deployment files in ``/var/www/[production|staging]/current`` are read-only (and owned by the ``deployer``
user). All data *written* by the app (the ``www-data`` user) goes into either ``cache`` or ``data`` of the ``shared``
folder.

### Create deployment user

	sudo adduser deployer --home /repos --shell /bin/bash --ingroup www-data
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

Also add ``scripts`` folder to the path for easy deployment commands.

	echo PATH="\$HOME/source/deploy/scripts:\$PATH" >> ~/.profile

## Upload Code

Still as user ``deployer``, create configuration file

	cd ~/source
	cp server/config/settings-dist.js ~/initial-production-settings.js
	cp server/config/settings-dist.js ~/initial-staging-settings.js
	ln -s ~/initial-production-settings.js /var/www/production/settings.js
	ln -s ~/initial-staging-settings.js /var/www/staging/settings.js
	vi /var/www/production/settings.js
	vi /var/www/staging/settings.js

Update and double-check all ``@important`` settings. When done, run

	npm install
	APP_SETTINGS=/var/www/production/settings.js node server/config/validate.js
	APP_SETTINGS=/var/www/staging/settings.js node server/config/validate.js

Check if your settings are valid. Then push the code to the server as described [here](DEPLOY.md). Of course the code
hot-swap will fail since there isn't anything running yet. However, code should be uploaded at the correct location, and
you can now start the services:

	sudo /bin/bash
	start vpdb-staging
	exit

Once VPDB gets a first release tag and you've pushed to production as well, don't forget to launch the service:

	start vpdb-production

## Setup Reverse Proxy

	sudo apt-get -y install nginx nginx-naxsi
	sudo mkdir -p /var/cache/nginx

Generate an SSL certificate:

	sudo /bin/bash
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
	sudo htpasswd -c /var/www/.htpasswd vpdb
	sudo chown www-data:www-data /var/www/.htpasswd
	sudo vi /etc/nginx/sites-available/vpdb-staging

Add this to the ``server { ... }`` block

	auth_basic "Restricted";
	auth_basic_user_file /var/www/.htpasswd;

## Administration Tools

### Genghis

*The single-file MongoDB admin app.*

Install PHP-FPM:

	sudo apt-get install -y php5-fpm php5-dev php5-cli php-pear php5-mongo
	sudo service php5-fpm restart
	
Install Genghis:
	
	cd /var/www
	sudo git clone https://github.com/bobthecow/genghis.git
	sudo chown www-data:www-data genghis -R

Setup nginx:

	sudo cp /repos/source/deploy/nginx/sites/genghis /etc/nginx/sites-available/genghis
	sudo ln -s /etc/nginx/sites-available/genghis /etc/nginx/sites-enabled/genghis

Secure access:
	
	sudo apt-get -y install apache2-utils
	sudo htpasswd -c /var/www/genghis/.htpasswd vpdb
	sudo chown www-data:www-data /var/www/genghis/.htpasswd

Restart nginx and we're good:

	sudo /etc/init.d/nginx restart

### Monitorix

*A free, open source, lightweight system monitoring tool.* 

Add repo and install:

	sudo echo deb http://apt.izzysoft.de/ubuntu generic universe >> /etc/apt/sources.list
	wget http://apt.izzysoft.de/izzysoft.asc
	sudo apt-key add izzysoft.asc
	sudo apt-get update
	sudo apt-get install -y monitorix
	sudo cp /repos/source/deploy/conf/monitorix.conf /etc/monitorix/
	
Not all plugins seem to with that package, so let's link the Git repo into its lib directory:

	cd /usr/local/src
	sudo git clone https://github.com/mikaku/Monitorix.git monitorix
	sudo mv /usr/lib/monitorix /usr/lib/monitorix-deb
	sudo ln -s /usr/local/src/monitorix/lib /usr/lib/monitorix
	sudo mv /usr/bin/monitorix /usr/bin/monitorix-deb
	sudo ln -s /usr/local/src/monitorix/monitorix /usr/bin/monitorix

Secure access:
	
	sudo htpasswd -c /etc/monitorix/.htpasswd vpdb
	sudo chown www-data:www-data /etc/monitorix/.htpasswd

Setup nginx:

	sudo cp /repos/source/deploy/nginx/sites/admin /etc/nginx/sites-available/admin
	sudo ln -s /etc/nginx/sites-available/admin /etc/nginx/sites-enabled/admin
	
	
### Boundary integration

Login, click the settings icon and paste the `curl` command under *Installation* into the shell. This installs the agent.
If you want to change the name of the host, do the following:

	sudo vi /etc/graphdat.conf
	sudo /etc/init.d/graphdat restart
	
For the relay, do [the following](http://premium-documentation.boundary.com/relays)

	sudo npm install graphdat-relay -g
	sudo mkdir -p /etc/graphdat-relay
	cd /etc/graphdat-relay
	sudo graphdat-relay -e "your email address" -t "your api token"
	sudo wget https://gist.github.com/codemoran/7441959/raw/bb3aa37c0052f87736f8b3ba57c3edccca520c07/graphdat-relay-debian-init
	sudo chmod +x graphdat-relay-debian-init
	sudo mv graphdat-relay-debian-init /etc/init.d/graphdat-relay
	sudo update-rc.d graphdat-relay defaults 
	

Where the API token is "Your API token", not the agent's or the embeded. If you want to change the name, do the 
following:

	sudo vi /etc/graphdat-relay/config.json
	sudo /etc/init.d/graphdat-relay restart
	
Then add your plugins like described [here](http://premium-support.boundary.com/customer/portal/articles/1635550-plugins---how-to?b_id=4456).
	

### New Relic integration

Pollers:

	sudo apt-get install -y python-pip
	sudo pip install newrelic-plugin-agent
	sudo pip install newrelic-plugin-agent[mongodb]
	sudo cp /opt/newrelic-plugin-agent/newrelic-plugin-agent.cfg /etc/newrelic/newrelic-plugin-agent.cfg
	sudo vi /etc/newrelic/newrelic-plugin-agent.cfg
	sudo mkdir /var/run/newrelic
	sudo chown newrelic /var/run/newrelic
	sudo newrelic-plugin-agent -c /etc/newrelic/newrelic-plugin-agent.cfg

	
## Links

* [DIY Node.js Server on Amazon EC2](http://cuppster.com/2011/05/12/diy-node-js-server-on-amazon-ec2/)
* [10 steps to nodejs nirvana in production](http://qzaidi.github.io/2013/05/14/node-in-production/)
* [The 4 Keys to 100% Uptime With Node.js](http://engineering.spanishdict.com/blog/2013/12/20/the-4-keys-to-100-uptime-with-nodejs)
* [visionmedia/deploy](https://github.com/visionmedia/deploy/blob/master/bin/deploy)
* [Stagecoach Ubuntu installer](https://github.com/punkave/stagecoach/blob/master/sc-proxy/install-node-and-mongo-on-ubuntu.bash)
* [Hardening Node.js for Production Part 2](http://blog.argteam.com/coding/hardening-node-js-for-production-part-2-using-nginx-to-avoid-node-js-load/)