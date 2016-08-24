# VPDB Production Setup

## Tech Stack

A minimal [Ubuntu LTS](http://www.ubuntu.com/) installation is going to be needed. 
The 16.04 distribution finally contains the OpenSSL and Nginx versions with the 
features we need, so no manual compilation is needed.

* [Ubuntu Server](http://www.ubuntu.com/) or any Debian-based distro as base OS
* [Node.js](http://nodejs.org/) for dynamic page serving
* [Nginx](http://nginx.org/) for static page serving and reverse proxy
* [Git](http://git-scm.com/) for push deployments on client side
* [PM2](https://github.com/Unitech/pm2), a production process manager for Node.js 
* [MongoDB](https://www.mongodb.org/) for data storage
* [Redis](http://redis.io/) for message queue, quota and ACLs 

## Install Ubuntu

Get Ubuntu 16.04 Server from [here](http://www.ubuntu.com/download/server). Start up
VirtualBox or VMWare and install Ubuntu using the downloaded ISO as installation
medium.

Make sure you enable OpenSSH. Once done, login and update the system:

	sudo apt update
	sudo apt -y upgrade
	
Enable automatic security updates (make sure `-security` is uncommented)
	
	sudo apt install unattended-upgrades
	sudo vi /etc/apt/apt.conf.d/50unattended-upgrades
	
Then make these are enabled:

	sudo vi /etc/apt/apt.conf.d/10periodic
	
	APT::Periodic::Update-Package-Lists "1";
	APT::Periodic::Download-Upgradeable-Packages "1";
	APT::Periodic::AutocleanInterval "7";
	APT::Periodic::Unattended-Upgrade "1";


### Setup Firewall

	sudo apt-get -y install iptables-persistent
	cd /etc/iptables
	sudo wget https://gist.githubusercontent.com/jirutka/3742890/raw/c025b0b8c58af49aa9644982c459314c9adba157/rules-both.iptables
	sudo vi rules-both.iptables

Update to your taste (unblock port 80, 443), then create symlinks and apply:

	sudo ln -s rules-both.iptables rules.v4
	sudo ln -s rules-both.iptables rules.v6
	sudo invoke-rc.d netfilter-persistent save
	sudo systemctl start netfilter-persistent
	sudo systemctl enable netfilter-persistent

### Harden System Security

[Shared Memory](https://help.ubuntu.com/community/StricterDefaults#Shared_Memory)

	sudo echo "none     /run/shm     tmpfs     defaults,ro     0     0" >> /etc/fstab

[SSH Root Login](https://help.ubuntu.com/community/StricterDefaults#SSH_Root_Login)

	sudo vi /etc/ssh/sshd_config

Set:

	Protocol 2
	PasswordAuthentication no
	PubkeyAuthentication yes
	PermitRootLogin no
	LogLevel VERBOSE

## Install Deps

### General Stuff

	sudo apt-get -y install rcconf git-core python-software-properties vim unrar tar

### Node.js

	cd
	sudo curl -sL https://deb.nodesource.com/setup_6.x -o nodesource_setup.sh
	sudo bash nodesource_setup.sh
	sudo apt-get install -y nodejs build-essential

	npm config set ca ""
	npm install -g npm
	npm install -g grunt-cli bower

### Image/Video Tools

	sudo apt -y install graphicsmagick pngquant optipng ffmpeg

### MongoDB

Install 3.x from repo:

	sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
	sudo su -
	echo "deb http://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.2 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list
	exit
	sudo apt-get -y update
	sudo apt-get install -y mongodb-org

Setup Systemd Script:

	sudo vi /etc/systemd/system/mongodb.service
	
	[Unit]
	Description=High-performance, schema-free document-oriented database
	After=network.target
	
	[Service]
	User=mongodb
	ExecStart=/usr/bin/mongod --quiet --config /etc/mongod.conf
	
	[Install]
	WantedBy=multi-user.target

Check if workie:

	sudo systemctl start mongodb
	sudo systemctl status mongodb
	sudo systemctl enable mongodb

### Redis

Install latest from repo:

	sudo apt-add-repository -y ppa:chris-lea/redis-server
	sudo apt-get update
	sudo apt-get install -y redis-server

### Nginx

	sudo apt-get install -y nginx-extras

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

### Setup PM2

	sudo npm install -g pm2
	su - deployer
	cp /repos/source/deploy/pm2 ~/ -r
	vi ~/pm2/staging.json
	vi ~/pm2/production.json
	pm2 start ~/pm2/staging.json
	
IF successful:
	
	pm2 save
	pm2 startup systemd
	sudo systemctl enable pm2

Make PM2 start *after* Redis & MongoDB:

	sudo vi /etc/systemd/system/pm2.service
	 
Add `mongodb.service redis-server.service` to the `After` config.

### SSL Config

Install the Letsencrypt bot

	cd /usr/local/bin
	sudo wget https://dl.eff.org/certbot-auto --no-check-certificate
	sudo chmod a+x certbot-auto
	sudo certbot-auto

Setup certificate

	mkdir /etc/nginx/ssl/letsencrypt -p
	cd /etc/nginx/ssl
	openssl dhparam -out dhparam.pem 2048
	sudo letsencrypt certonly --webroot -w /etc/nginx/ssl/letsencrypt -d test.vpdb.io

### Configure Nginx

	sudo cp /repos/source/deploy/nginx/nginx.conf /etc/nginx
	sudo cp /repos/source/deploy/nginx/sites/production.conf /etc/nginx/sites-available/vpdb-production.conf
	sudo cp /repos/source/deploy/nginx/sites/staging.conf /etc/nginx/sites-available/vpdb-staging.conf
	sudo cp /repos/source/deploy/nginx/sites/staging-devsite.conf /etc/nginx/sites-available/vpdb-staging-devsite.conf
	sudo ln -s /etc/nginx/sites-available/vpdb-production.conf /etc/nginx/sites-enabled/vpdb-production.conf
	sudo ln -s /etc/nginx/sites-available/vpdb-staging.conf /etc/nginx/sites-enabled/vpdb-staging.conf
	sudo ln -s /etc/nginx/sites-available/vpdb-staging-devsite.conf /etc/nginx/sites-enabled/vpdb-staging-devsite.conf

Update configuration:

	sudo vi /etc/nginx/sites-available/vpdb-production.conf
	sudo vi /etc/nginx/sites-available/vpdb-staging.conf
	sudo vi /etc/nginx/sites-available/vpdb-staging-devsite.conf

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

### MongoDB Replication

On primary (and all replicas), open `/etc/mongod.conf` and enable replication:

	replication:
	  replSetName: rs0

Restart primary and all replicas:

	systemctl restart mongod

Make sure that all secondaries are clean and empty, otherwise they'll be stuck 
in `ROLLBACK`. Clearing data folder before restarting helps. Then connect to 
primary, enable replication and add replicas:

	mongo
	rs.initiate()
	rs.conf()
	rs.add({ host: "vpdb.secondary", priority: 0, hidden: true })

On secondaries, enable slaves in order to read:

	db.getMongo().setSlaveOk()
	show dbs
	use vpdb
	db.tags.find()

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