# VPDB Production Setup

## Tech Stack

* [Ubuntu Server](http://www.ubuntu.com/) or any Debian-based distro as base OS
* [Node.js](http://nodejs.org/) for dynamic page serving
* [Nginx](http://nginx.org/) for static page serving and reverse proxy
* [Git](http://git-scm.com/) for push deployments on client side
* [Phusion Passenger](https://www.phusionpassenger.com/) for Node process management within Nginx
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


## Install Deps

### General Stuff

	sudo apt-get -y install rcconf git-core python-software-properties vim
	sudo apt-get -y install build-essential checkinstall rake zlib1g-dev libpcre3 libpcre3-dev libbz2-dev libssl-dev tar libcurl4-openssl-dev ruby-dev

### Node.js

	sudo curl https://raw.githubusercontent.com/creationix/nvm/v0.24.0/install.sh | bash
	sudo nvm install 0.12

Upgrade ``npm`` to latest and prevent self-signed certificate error

	sudo npm config set ca ""
	sudo npm install -g npm
	sudo npm install -g grunt-cli bower

### Image Tools

	sudo apt-get -y install graphicsmagick pngquant optipng

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

Paste this at the end of `/etc/init/mongod.conf`:

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

	sudo apt-add-repository -y ppa:chris-lea/redis-server
	sudo apt-get update
	sudo apt-get install -y redis-server

### Nginx

Since Nginx doesn't support external modules (by design), you'll need need to compile it with the desired modules.

External modules:

 * [Naxsi](https://github.com/nbs-system/naxsi) - Anti XSS & SQL Injection
 * [Phusion Passenger](https://github.com/phusion/passenger) - A fast and robust web server and application server for Ruby, Python and Node.js (see below)
 * [ngx_headers_more](https://github.com/openresty/headers-more-nginx-module) - Set, add, and clear arbitrary output headers
 * [ngx_pagespeed](https://github.com/pagespeed/ngx_pagespeed) - Automatic PageSpeed optimization
 * [ngx_cache_purge](https://github.com/FRiCKLE/ngx_cache_purge) - Purge content from FastCGI, proxy, SCGI and uWSGI caches.

Note we use Passenger's master, since beta2 at time of writing didn't compile.
As soon as v5 goes final, it should be the one.

Setup Phusion Passenger:

	cd /usr/local/src
	wget https://github.com/phusion/passenger/archive/release-5.0.6.tar.gz
	tar xvfz release-5.0.6.tar.gz

Add `/opt/passenger/bin` to `PATH`:

	ln -s /usr/local/src/passenger-release-5.0.6 /opt/passenger
	vi /etc/environment

Download and compile Nginx. See [compile script](deploy/nginx/compile.sh) how to do that.

Copy needed vendor config files:

	sudo cp /usr/local/src/naxsi-master/naxsi_config/naxsi_core.rules /etc/nginx/
	sudo mv /etc/nginx/mime.types.default /etc/nginx/mime.types
	sudo mv /etc/nginx/fastcgi_params.default /etc/nginx/fastcgi_params


## Setup Push Deployment

For client documentation, check the [deployment guide](DEPLOY.md).

### Create file structure

	sudo mkdir -p /var/www/production/shared/logs /var/www/production/shared/cache /var/www/production/shared/data /var/www/production/config
	sudo mkdir -p /var/www/staging/shared/logs /var/www/staging/shared/cache /var/www/staging/shared/data /var/www/staging/config

	sudo chmod 770 /var/www /var/www/production /var/www/staging -R

The `shared` folder contains the following:

* `logs` - Log files from the workers and naught
* `data` - User-generated files.
* `cache` - Auto-generated files.

Note that the deployment files in `/var/www/[production|staging]/current` are read-only (and owned by the `deployer`
user). All data *written* by the app (the `www-data` user) goes into either `cache` or `data` of the `shared`
folder.

### Create deployment user

	sudo adduser deployer --home /repos --shell /bin/bash --ingroup www-data --disabled-password
	sudo chown deployer:www-data /var/www /repos -R
	sudo chown www-data:www-data /var/www/production/shared/cache /var/www/production/shared/data -R
	sudo chown www-data:www-data /var/www/staging/shared/cache /var/www/staging/shared/data -R

	sudo su - deployer
	mkdir .ssh
	chmod 700 .ssh
	vi .ssh/authorized_keys

Paste your pub key in there.

### Setup bare Git repositories

Still as user `deployer`:

	cd ~
	git clone --mirror https://github.com/freezy/node-vpdb.git staging
	git clone --mirror https://github.com/freezy/node-vpdb.git production
	chmod 700 /repos/production /repos/staging

Setup deployment hooks:

	cd ~
	git clone https://github.com/freezy/node-vpdb.git source
	ln -s ~/source/deploy/hooks/post-receive-production ~/production/hooks/post-receive
	ln -s ~/source/deploy/hooks/post-receive-staging ~/staging/hooks/post-receive
	ln -s ~/source/deploy/hooks/common ~/production/hooks/common
	ln -s ~/source/deploy/hooks/common ~/staging/hooks/common

Also add `scripts` folder to the path for easy deployment commands.

	echo PATH="\$HOME/source/deploy/scripts:\$PATH" >> ~/.profile

## Upload Code

Still as user `deployer`, create configuration file

	cd ~/source
	cp server/config/settings-dist.js ~/initial-production-settings.js
	cp server/config/settings-dist.js ~/initial-staging-settings.js
	ln -s ~/initial-production-settings.js /var/www/production/settings.js
	ln -s ~/initial-staging-settings.js /var/www/staging/settings.js
	vi /var/www/production/settings.js
	vi /var/www/staging/settings.js

Update and double-check all `@important` settings. When done, run

	npm install
	APP_SETTINGS=/var/www/production/settings.js node server/config/validate.js
	APP_SETTINGS=/var/www/staging/settings.js node server/config/validate.js

Check if your settings are valid. Then deploy a first time. Still as user `deployer`:

	vpdb_staging_deploy

Of course the code hot-swap will fail since there isn't anything running yet.
However, code should be copied to the correct location, and you can now
configure Nginx. For future deployements, refer to the [deployment guide](DEPLOY.md).


## Setup Reverse Proxy

### SSL Certs

	mkdir /etc/nginx/ssl
	cd /etc/nginx/ssl
	openssl req -new -days 365 -nodes -keyout xxx.vpdb.ch.key -out xxx.vpdb.ch.csr

Submit `xxx.vpdb.ch.csr` to signing authority, then paste received certificate into `xxx.vpdb.ch.crt`. Then
build the key chain:

	cat xxx.vpdb.ch.crt startssl-sub.class1.server.ca.pem startssl-ca.pem > xxx.vpdb.ch-keychain.crt

### Configure Nginx

	sudo mkdir -p /etc/nginx/sites-available /etc/nginx/sites-enabled /etc/nginx/conf.d
	sudo cp /repos/source/deploy/nginx/nginx.conf /etc/nginx
	sudo cp /repos/source/deploy/nginx/sites/production.conf /etc/nginx/sites-available/vpdb-production.conf
	sudo cp /repos/source/deploy/nginx/sites/staging.conf /etc/nginx/sites-available/vpdb-staging.conf
	sudo cp /repos/source/deploy/nginx/sites/staging-devsite.conf /etc/nginx/sites-available/vpdb-staging-devsite.conf
	sudo ln -s /etc/nginx/sites-available/vpdb-production.conf /etc/nginx/sites-enabled/vpdb-production.conf
	sudo ln -s /etc/nginx/sites-available/vpdb-staging.conf /etc/nginx/sites-enabled/vpdb-staging.conf
	sudo ln -s /etc/nginx/sites-available/vpdb-staging-devsite.conf /etc/nginx/sites-enabled/vpdb-staging-devsite.conf

Update configuration:

	sudo vi /etc/nginx/sites-available/vpdb-production
	sudo vi /etc/nginx/sites-available/vpdb-staging
	sudo vi /etc/nginx/sites-available/vpdb-staging-devsite

Make `deployer` able to reload Passenger:

	sudo chmod 640 /etc/sudoers
	echo "deployer ALL=(ALL) NOPASSWD: /opt/passenger/bin/passenger-config" >> /etc/sudoers
	sudo chmod 440 /etc/sudoers

Then start nginx:

	service nginx start

If you want to protect your site:

	sudo apt-get -y install apache2-utils
	sudo htpasswd -c /var/www/.htpasswd vpdb
	sudo chown www-data:www-data /var/www/.htpasswd
	sudo vi /etc/nginx/sites-available/vpdb-staging

Add this to the `server { ... }` block

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

	sudo cp /repos/source/deploy/nginx/sites/genghis.conf /etc/nginx/sites-available/genghis
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

	sudo cp /repos/source/deploy/nginx/sites/admin.conf /etc/nginx/sites-available/admin
	sudo ln -s /etc/nginx/sites-available/admin /etc/nginx/sites-enabled/admin
	

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
* [Why we don't use a CDN](https://thethemefoundry.com/blog/why-we-dont-use-a-cdn-spdy-ssl/)
* [5 Easy Tips to Accelerate SSL](http://unhandledexpression.com/2013/01/25/5-easy-tips-to-accelerate-ssl/)
* [Guide to Nginx + SSL + SPDY](https://www.mare-system.de/guide-to-nginx-ssl-spdy-hsts/)
* [SSL Test](https://www.ssllabs.com/ssltest/index.html)