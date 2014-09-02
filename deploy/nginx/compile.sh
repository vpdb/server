#!/bin/sh

cd /usr/local/src

# deps
apt-get -y install build-essential checkinstall zlib1g-dev libpcre3 libpcre3-dev libbz2-dev libssl-dev tar

# download source, plus naxsi, headers-more and pagespeed.
wget http://nginx.org/download/nginx-1.7.4.tar.gz
wget https://github.com/nbs-system/naxsi/archive/master.tar.gz -O naxsi-master.tar.gz
wget https://github.com/openresty/headers-more-nginx-module/archive/v0.25.tar.gz -O headers-more-0.25.tar.gz
wget https://github.com/pagespeed/ngx_pagespeed/archive/v1.8.31.4-beta.tar.gz -O pagespeed-1.8.31.4-beta.tar.gz
wget https://github.com/FRiCKLE/ngx_cache_purge/archive/2.1.tar.gz -O cache_purge-2.1.tar.gz

tar xvfz nginx-1.7.4.tar.gz
tar xvfz headers-more-0.25.tar.gz
tar xvfz naxsi-master.tar.gz
tar xvfz pagespeed-1.8.31.4-beta.tar.gz
tar xvfz cache_purge-2.1.tar.gz

# download pagespeed dep
cd ngx_pagespeed-*
grep psol README.md
wget https://dl.google.com/dl/page-speed/psol/1.8.31.4.tar.gz -O psol-1.8.31.4.tar.gz
tar xvfz psol-1.8.31.4.tar.gz
cd ..

# configure
cd nginx-1.7.4
./configure \
--add-module=../naxsi-master/naxsi_src \
--prefix=/usr/local \
--conf-path=/etc/nginx/nginx.conf  \
--pid-path=/var/run/nginx.pid \
--lock-path=/var/lock/nginx.lock \
--error-log-path=/var/log/nginx/error.log \
--http-log-path=/var/log/nginx/access.log \
--user=www-data \
--group=www-data \
--without-mail_pop3_module \
--without-mail_imap_module \
--without-mail_smtp_module \
--without-http_uwsgi_module \
--without-http_scgi_module \
--with-http_ssl_module \
--with-http_realip_module \
--with-http_sub_module \
--with-http_spdy_module \
--with-http_flv_module \
--with-http_mp4_module \
--with-http_spdy_module \
--with-http_gunzip_module \
--with-http_gzip_static_module \
--with-http_random_index_module \
--with-http_secure_link_module \
--with-http_stub_status_module \
--with-http_auth_request_module \
--with-file-aio \
--with-debug \
--with-ipv6 \
--with-cc-opt='-g -O2 -fstack-protector --param=ssp-buffer-size=4 -Wformat -Werror=format-security -Wp,-D_FORTIFY_SOURCE=2' \
--with-ld-opt='-Wl,-z,relro -Wl,--as-needed' \
--add-module=../ngx_pagespeed-1.8.31.4-beta \
--add-module=../ngx_cache_purge-2.1

# compile
make

# install
checkinstall --install=no -y
dpkg -i nginx_1.7.4-1_amd64.deb
cp /repos/source/deploy/init/nginx /etc/init.d/
update-rc.d -f nginx defaults

# folders
mkdir -p /var/log/nginx /var/cache/nginx
chown www-data:www-data /var/log/nginx /var/cache/nginx
