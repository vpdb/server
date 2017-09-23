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

	sudo apt -y install iptables-persistent
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


### General Stuff

	sudo apt -y install rcconf git-core python-software-properties vim unrar tar libcurl4-openssl-dev 
	
### Cleaning up `/boot`
	
	sudo apt purge linux-image-4.4.0-xx-generic
	sudo apt autoremove

## Node.js

	cd
	sudo curl -sL https://deb.nodesource.com/setup_6.x -o nodesource_setup.sh
	sudo bash nodesource_setup.sh
	sudo apt install -y nodejs build-essential

	npm config set ca ""
	npm install -g grunt grunt-cli bower

## Image/Video Tools

	sudo apt -y install graphicsmagick pngquant optipng ffmpeg

## MongoDB

Install 3.2 from repo:

	sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv EA312927
	sudo su -
	echo "deb http://repo.mongodb.org/apt/ubuntu xenial/mongodb-org/3.2 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-3.2.list
	exit
	sudo apt -y update
	sudo apt install -y mongodb-org

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
	
### Authentication
	
Create users:
	
	sudo adduser mongotunnel --home /home/mongotunnel --shell /bin/bash --disabled-password
	mongo
	
	use admin
	db.createUser({
	  user: "root",
	  pwd: "<password>",
	  roles: [ { role: "root", db: "admin" } ]
	});
	db.createUser({
	  user: "admin",
	  pwd: "<password>",
	  roles: [ { role: "userAdminAnyDatabase", db: "admin" } ]
	});
	use vpdb-production
	db.createUser({
	  user: "vpdb",
	  pwd: "<password>",
	  roles: [ { role: "readWrite", db: "vpdb-production" } ]
	})
	
	sudo systemctl stop mongodb
	openssl rand -base64 741 > /home/mongotunnel/keyfile
	chown mongodb /home/mongotunnel/keyfile
	chmod 600 /home/mongotunnel/keyfile

Enable authentication

	vi /etc/mongod.conf
	
	security:
	  authorization: enabled
	  keyFile: /home/mongotunnel/keyfile
     
	sudo systemctl start mongodb

### Replication

Connections to replica servers are tunneled through SSH. In order to find the 
correct hosts within in the sets, we'll have the following configuration:

- Primary: MongoDB running on `127.0.1.1:27017`
- Secondary: MongoDB running on `127.0.2.2:27018`
- Tertiary: MongoDB running on `127.0.3.3:27019`
- Arbiter 1: MongoDB running on `127.0.10.10:27100` (on primary)
- Arbiter 2: MongoDB running on `127.0.20.20:27200` (on primary)

#### Setup SSH Tunnels

In order to support the above setup, we'll have to setup the following SSH tunnels:

Primary to secondary:
	
- Local `127.0.2.2:27018` to remote `127.0.2.2:27018` - Primary accesses secondary
- Remote `127.0.1.1:27017` to local `127.0.1.1:27017` - Secondary accesses primary
- Remote `127.0.10.10:27100` to local `127.0.10.10:27100` - Secondary accesses arbiter 1
- Remote `127.0.20.20:27200` to local `127.0.20.20:27200` - Secondary accesses arbiter 2

Primary to tertiary:

- Local `127.0.3.3:27019` to remote `127.0.3.3:27019` - Primary accesses tertiary
- Remote `127.0.1.1:27017` to local `127.0.1.1:27017` - Tertiary accesses primary
- Remote `127.0.10.10:27100` to local `127.0.10.10:27100` - Tertiary accesses arbiter 1
- Remote `127.0.20.20:27200` to local `127.0.20.20:27200` - Tertiary accesses arbiter 2

Secondary to tertiary:

- Local `127.0.3.3:27019` to remote `127.0.3.3:27019` - Primary accesses tertiary
- Remote `127.0.2.2:27018` to local `127.0.2.2:27018` - Secondary accesses primary

On primary and secondary, create SSH keypair with no password:

	su - mongotunnel
	mkdir ~/.ssh
	chmod 700 ~/.ssh
	ssh-keygen -t rsa
	cat ~/.ssh/id_rsa.pub
	
On primary, change MongoDB interface to `127.0.1.1`
	
	vi /etc/mongod.conf
	systemctl restart mongodb
	
On secondaries, create the tunnel user and add the keypair to `authorized_keys`:

	sudo adduser mongotunnel --home /home/mongotunnel --shell /bin/bash --disabled-password
	su - mongotunnel
	mkdir ~/.ssh
	chmod 700 ~/.ssh
	vi ~/.ssh/authorized_keys
	chmod 700 ~/.ssh/authorized_keys
	
On secondary, create keypair and add it to tertiary

	su - mongotunnel
	ssh-keygen -t rsa
	cat ~/.ssh/id_rsa.pub
	
On tertiary:
	
	vi ~/.ssh/authorized_keys
	
Also enable `GatewayPorts` all instances so we can tunnel to 127.0.1.*.
	
	vi /etc/ssh/sshd_config
	
	Match User mongotunnel
	   GatewayPorts yes

	systemctl restart sshd.service
	
Rename currently installed MongoDB instance on secondary and tertiary:
	
	sudo systemctl stop mongodb
	sudo cp /etc/systemd/system/mongodb.service /etc/systemd/system/mongodb-replica.service
	sudo cp /etc/mongod.conf /etc/mongod-replica.conf
	sudo vi /etc/mongod-replica.conf
	sudo vi /etc/systemd/system/mongodb-replica.service
	
	ExecStart=/usr/bin/mongod --quiet --config /etc/mongod-replica.conf
	
	sudo systemctl start mongodb-replica
	sudo systemctl status mongodb-replica
	sudo systemctl enable mongodb-replica
	
On secondary, change MongoDB interface and port to `127.0.2.2:27018`:

	vi /etc/mongod-replica.conf
	systemctl restart mongodb-replica

On tertiary, change MongoDB interface and port to `127.0.3.3:27019`:

	vi /etc/mongod-replica.conf
	systemctl restart mongodb-replica

On primary, test connection and confirm fingerprint:
	
	su - mongotunnel
	ssh secondary.vpdb -l mongotunnel
	ssh home.vpdb -l mongotunnel
	
And on secondary:
	
	su - mongotunnel
	ssh home.vpdb -l mongotunnel
	
Now setup SSH tunnels. Back as root on primary:

	sudo apt install -y autossh
	vi /etc/systemd/system/mongotunnel.backup.service
	
	[Unit]
	Description=Keeps a tunnel to 'vpdb.secondary' open
	After=network-online.target
	
	[Service]
	User=mongotunnel
	ExecStart=/usr/bin/autossh -M 0 -N -q -o "ServerAliveInterval 60" -o "ServerAliveCountMax 3" -p 22 -l mongotunnel secondary.vpdb -L 127.0.2.2:27018:127.0.2.2:27018 -R 127.0.1.1:27017:127.0.1.1:27017 -R 127.0.10.10:27100:127.0.10.10:27100 -R 127.0.20.20:27200:127.0.20.20:27200 -i /home/mongotunnel/.ssh/id_rsa
	
	[Install]
	WantedBy=multi-user.target
	
Try it out:
	
	sudo systemctl start mongotunnel.backup
	sudo systemctl status mongotunnel.backup
	sudo systemctl enable mongotunnel.backup
	mongo --host 127.0.2.2 --port 27018
	
Still on primary:
	
	vi /etc/systemd/system/mongotunnel.home.service
	
	[Unit]
	Description=Keeps a tunnel to 'vpdb.home' open
	After=network-online.target
	
	[Service]
	User=mongotunnel
	ExecStart=/usr/bin/autossh -M 0 -N -q -o "ServerAliveInterval 60" -o "ServerAliveCountMax 3" -p 22 -l mongotunnel home.vpdb -L 127.0.3.3:27019:127.0.3.3:27019 -R 127.0.1.1:27017:127.0.1.1:27017 -R 127.0.10.10:27100:127.0.10.10:27100 -R 127.0.20.20:27200:127.0.20.20:27200 -i /home/mongotunnel/.ssh/id_rsa
	
	[Install]
	WantedBy=multi-user.target
	
Test:
	
	sudo systemctl start mongotunnel.home
	sudo systemctl status mongotunnel.home
	sudo systemctl enable mongotunnel.home
	mongo --host 127.0.3.3 --port 27019
	
On secondary:

	sudo apt install -y autossh
	vi /etc/systemd/system/mongotunnel.home.service
	
	[Unit]
	Description=Keeps a tunnel to 'vpdb.home' open
	After=network-online.target
	
	[Service]
	User=mongotunnel
	ExecStart=/usr/bin/autossh -M 0 -N -q -o "ServerAliveInterval 60" -o "ServerAliveCountMax 3" -p 22 -l mongotunnel home.vpdb -L 127.0.3.3:27019:127.0.3.3:27019 -R 127.0.2.2:27018:127.0.2.2:27018 -i /home/mongotunnel/.ssh/id_rsa
	
	[Install]
	WantedBy=multi-user.target
	
Test:
	
	sudo systemctl start mongotunnel.home
	sudo systemctl status mongotunnel.home
	sudo systemctl enable mongotunnel.home
	mongo --host 127.0.3.3 --port 27019

#### Setup Replication

First, create two arbiter instances so the primary doesn't go back to secondary 
when backup is offline:

	sudo mkdir /var/lib/mongodb-arbiter-1 /var/lib/mongodb-arbiter-2
	sudo chown mongodb:mongodb /var/lib/mongodb-arbiter*
	sudo cp /etc/systemd/system/mongodb.service /etc/systemd/system/mongodb-arbiter-1.service
	sudo cp /etc/systemd/system/mongodb.service /etc/systemd/system/mongodb-arbiter-2.service
	vi /etc/systemd/system/mongodb-arbiter-1.service
	
	ExecStart=/usr/bin/mongod --quiet --bind_ip 127.0.10.10 --port 27100 --smallfiles --nojournal --noprealloc --replSet "rs0" --dbpath /var/lib/mongodb-arbiter-1 --keyFile /home/mongotunnel/keyfile --logpath /var/log/mongodb/mongodb-arbiter-1.log

	vi /etc/systemd/system/mongodb-arbiter-2.service
	
	ExecStart=/usr/bin/mongod --quiet --bind_ip 127.0.20.20 --port 27200 --smallfiles --nojournal --noprealloc --replSet "rs0" --dbpath /var/lib/mongodb-arbiter-2 --keyFile /home/mongotunnel/keyfile --logpath /var/log/mongodb/mongodb-arbiter-2.log

	systemctl start mongodb-arbiter-1.service
	systemctl start mongodb-arbiter-2.service
	systemctl status mongodb-arbiter-1.service
	systemctl status mongodb-arbiter-2.service
	systemctl enable mongodb-arbiter-1.service
	systemctl enable mongodb-arbiter-2.service

On primary and all replicas enable replication:

	vi /etc/mongod-replica.conf

	replication:
	  replSetName: rs0
	  
Still on primary, copy the key file to secondaries
	 
	chmod 666 /home/mongotunnel/keyfile 
	su - mongotunnel
	scp /home/mongotunnel/keyfile mongotunnel@secondary.vpdb:/home/mongotunnel/keyfile 
	scp /home/mongotunnel/keyfile mongotunnel@home.vpdb:/home/mongotunnel/keyfile
	exit
	chmod 600 /home/mongotunnel/keyfile

On secondaries, enable keyfile authentication and change data and log path:

	mkdir /var/lib/mongodb-replica
	chown mongodb:mongodb /home/mongotunnel/keyfile /var/lib/mongodb-replica
	chmod 600 /home/mongotunnel/keyfile
	vi /etc/mongod-replica.conf
	
	storage:
      dbPath: /var/lib/mongodb-replica
	systemLog:
	  path: /var/log/mongodb/mongod-replica.log
	security:
	  authorization: enabled
	  keyFile: /home/mongotunnel/keyfile

Restart primary and all replicas:

	systemctl restart mongodb-replica

Make sure that all secondaries are clean and empty, otherwise they'll be stuck 
in `ROLLBACK`. Clearing data folder before restarting helps.

Test on all instances that all connections are fine:

	mongo --host 127.0.1.1 --port 27017
	mongo --host 127.0.2.2 --port 27018
	mongo --host 127.0.3.3 --port 27019
	mongo --host 127.0.10.10 --port 27100
	mongo --host 127.0.20.20 --port 27200

Then connect to primary, configure replication and add replicas:

	mongo --host 127.0.1.1
	
	use admin
	db.auth("root", "<password>");
	rs.initiate({ _id:"rs0", members: [{ _id: 1, host: "127.0.1.1:27017" }]})
	rs.conf()
	rs.add({ host: "127.0.2.2:27018", priority: 0, hidden: true })
	rs.add({ host: "127.0.3.3:27019", priority: 0, hidden: true })
	rs.addArb("127.0.10.10:27100")
	rs.addArb("127.0.20.20:27200")
	
Setup backup script
	
	mkdir /var/data/mongobak
	chown deployer /var/data/mongobak
	chmod 770 /var/data/mongobak
	su - deployer
	wget https://raw.githubusercontent.com/micahwedemeyer/automongobackup/master/src/automongobackup.sh
	chmod 755 automongobackup.sh
	vi automongobackup.sh
	
Update config and test:

	./automongobackup.sh
	
If okay, add to crontab:

	crontab -e
	0 8 * * * ~/automongobackup.sh

## Redis

Install latest from repo:

	sudo apt-add-repository -y ppa:chris-lea/redis-server
	sudo apt update
	sudo apt install -y redis-server

## Nginx

	sudo apt install -y nginx-extras

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
	git clone --mirror https://github.com/vpdb/backend.git staging
	git clone --mirror https://github.com/vpdb/backend.git production
	chmod 700 /repos/production /repos/staging

Setup deployment hooks:

	cd ~
	git clone https://github.com/vpdb/backend.git source
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
configure Nginx. For future deployments, refer to the [deployment guide](DEPLOY.md).


## Setup Reverse Proxy

### Setup PM2

	sudo npm install -g pm2 pmx
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

Setup log rotation:

	pm2 install pm2-logrotate
	pm2 set pm2-logrotate:max_size 100M
	pm2 set pm2-logrotate:compress true

### SSL Config

Install the Letsencrypt bot

	sudo apt install letsencrypt
	
Setup certificate path

	mkdir /etc/nginx/ssl/letsencrypt -p
	cd /etc/nginx/ssl
	openssl dhparam -out dhparam.pem 2048

### Configure Nginx

	sudo cp /repos/source/deploy/nginx/nginx.conf /etc/nginx
	
	sudo cp /repos/source/deploy/nginx/sites/api.conf /etc/nginx/sites-available/api-site-name.conf
	sudo cp /repos/source/deploy/nginx/sites/storage.conf /etc/nginx/sites-available/storage-site-name.conf
	sudo cp /repos/source/deploy/nginx/sites/www.conf /etc/nginx/sites-available/www-site-name.conf
	sudo cp /repos/source/deploy/nginx/sites/developer.conf /etc/nginx/sites-available/developer-site-name.conf
	
If not SSL is set up yet:
	
	vi /etc/nginx/sites-enabled/letsencrypt.conf
	
	server {
		listen 80;
		server_name <host name 1> <host name 2> <host name 3>;

		location ~ /.well-known {
			root /etc/nginx/ssl/letsencrypt;
			allow all;
		}
	}
	
Then run the Letsencrypt bot
	
	sudo systemctl restart nginx
	sudo letsencrypt certonly --webroot -w /etc/nginx/ssl/letsencrypt -d <host name 1> -d <host name 2> -d <host name 3>;
	
If okay, remove initial config
	
	rm /etc/nginx/sites-enabled/letsencrypt.conf

When certs are at their place, update configuration:

	sudo vi /etc/nginx/sites-available/api-site-name.conf
	sudo vi /etc/nginx/sites-available/storage-site-name.conf
	sudo vi /etc/nginx/sites-available/www-site-name.conf
	sudo vi /etc/nginx/sites-available/developer-site-name.conf

If all good, link:

	sudo ln -s /etc/nginx/sites-available/api-site-name.conf /etc/nginx/sites-enabled/api-site-name.conf
	sudo ln -s /etc/nginx/sites-available/storage-site-name.conf /etc/nginx/sites-enabled/storage-site-name.conf
	sudo ln -s /etc/nginx/sites-available/www-site-name.conf /etc/nginx/sites-enabled/www-site-name.conf
	sudo ln -s /etc/nginx/sites-available/developer-site-name.conf /etc/nginx/sites-enabled/developer-site-name.conf
	
Then start nginx:

	sudo systemctl restart nginx
	
And setup Letsencrypt renewal (and reload nginx one a week)

	sudo crontab -e
	
	23 4,16 * * * letsencrypt renew
	30 4    * * 0 systemctrl reload nginx

If you want to protect your site:

	sudo apt -y install apache2-utils
	sudo htpasswd -c /var/www/.htpasswd vpdb
	sudo chown www-data:www-data /var/www/.htpasswd
	sudo vi /etc/nginx/sites-available/<site-to-protect>.conf

Add this to the `server { ... }` block

	auth_basic "Restricted";
	auth_basic_user_file /var/www/.htpasswd;
	
	sudo systemctl restart nginx
	
## Setup Backup/Staging Instance

This instance isn't part of the replica, data is just copied over from the file system.

On secondary and tertiary:

	sudo vi /etc/mongod.conf
	
	net:
	  port: 27010
	  bindIp: 127.0.100.100
	security:
	  authorization: enabled
	  
On primary, generate key pair for rsync file system push synch:	  

	su - deployer
	ssh-keygen -t rsa
	cat ~/.ssh/id_rsa.pub
	
On secondaries, add public key.
	
	su - deployer
	vi ~/.ssh/authorized_keys
	
On primary, accept fingerprint and setup cron job (also replace staging with prod)
	
	su - deployer
	ssh secondary.vpdb
	ssh home.vpdb
	mkdir ~/logs
	crontab -e
	
	1,11,21,31,41,51 * * * * rsync -avz /var/www/staging/shared/data/storage-public/ secondary.vpdb:/var/www/staging/shared/data/storage-public > ~/logs/cron-secondary-public.log 2>&1
	3,13,23,33,43,53 * * * * rsync -avz /var/www/staging/shared/data/storage-protected/ secondary.vpdb:/var/www/staging/shared/data/storage-protected > ~/logs/cron-secondary-protected.log 2>&1
	5,15,25,35,45,55 * * * * rsync -avz /var/www/staging/shared/data/storage-public/ home.vpdb:/var/www/staging/shared/data/storage-public > ~/logs/cron-home-public.log 2>&1
	7,17,27,37,47,57 * * * * rsync -avz /var/www/staging/shared/data/storage-protected/ home.vpdb:/var/www/staging/shared/data/storage-protected > ~/logs/cron-home-protected.log 2>&1

## Administration Tools

### Monitorix

*A free, open source, lightweight system monitoring tool.* 

Add repo and install:

	sudo echo deb http://apt.izzysoft.de/ubuntu generic universe >> /etc/apt/sources.list
	wget http://apt.izzysoft.de/izzysoft.asc
	sudo apt-key add izzysoft.asc
	sudo apt update
	sudo apt install -y monitorix
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

	sudo apt install -y python-pip
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