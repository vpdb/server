# Logging

While dumping logs lines to a file is quite trivial, VPDB also uses structured
logs to load into the [Elastic Stack](https://www.elastic.co/elk-stack). This 
setup is less trivial and described below.

## Source

VPDB can log in JSON format by providing the `vpdb.logging.file.json` config.
This writes a JSON object on every line containing structured log data. For
example, a typical line like this:

```js
logger.info(ctx.state, '[Strategy.authenticate] Successfully authenticated with user <%s>.', user.email);
```

ends up like this (formatted for your convenience):

```json
{
  "time": "2018-08-15T20:01:24.754Z",
  "level": "info",
  "request": {
    "id": "cT0QyiU79u",
    "ip": "1.2.3.4",
    "path": "/api/v1/authenticate"
  },
  "module": "AuthenticationApi.authenticate",
  "message": "User <freezy@vpdb.io> successfully authenticated using token.",
  "type": "app"
}
```

HTTP requests get logged in a similar way:

```json
{
  "time": "2018-08-15T20:03:20.629Z",
  "level": "info",
  "request": {
    "id": "NL39b2UMp9",
    "ip": "1.2.3.4",
    "method": "GET",
    "path": "/api/v1/games?min_releases=1&page=1&perPage=12&sort=popularity"
  },
  "user": {
    "id": "e2vue3x1",
    "email": "freezy@vpdb.io",
    "name": "freezy"
  },
  "tokenType": "jwt-refreshed",
  "type": "access",
  "message": "GET /api/v1/games?min_releases=1&page=1&perPage=12&sort=popularity [200]",
  "response": {
    "status": 200,
    "duration": 75,
    "size": 22098,
    "cached": true
  }
}
```

You'll see there's more HTTP-related data. For other requests than `GET` or 
`OPTIONS`, request and response headers and data is added as well. Sensitive 
data is stripped off.

Note that the `request.id` is a random string generated at the beginning of the
request and available on every log entry produced by that request. This allows
filtering messages for a given request only.

## The Elastic Stack

In short, we're setting it up like this:

    VPDB -> Beats -> Logstash -> Elasticsearch -> Kibana

### Beats

The logfile containing JSON data is read by [Filebeat](https://www.elastic.co/products/beats/filebeat).
The configuration is pretty straight-forward:

```yaml
filebeat.inputs:
- type: log
  enabled: true
  paths:
    - /var/www/server/production/shared/logs/vpdb-api.json.log
  tags: ["vpdb", "json"]
  
fields:
  env: production
fields_under_root: true

output.logstash:
  hosts: ["logstashserver:5044"]
  ssl.certificate_authorities: ["/path/to/cert.crt"]
  ssl.certificate: "/path/to/cert.crt"
  ssl.key: "/path/to/cert.key"    
```

This sends each line as-is to Logstash, tags it as `json` and `vpdb` and adds an `env` 
field so we can easily filter between the different environments.

For the Nginx log, we're using [Filebeat's Nginx module](https://www.elastic.co/guide/en/beats/filebeat/current/filebeat-module-nginx.html)
with the following config:

```yaml
- module: nginx
  access:
    enabled: true
    var.paths: ["/var/log/nginx/storage.*vpdb.io-access.log", "/var/log/nginx/storage-api.*vpdb.io-access.log", "/var/log/nginx/api.*vpdb.io-access.log", "/var/log/nginx/www.*vpdb.io-access.log"]

  # Error logs
  error:
    enabled: true
    var.paths: ["/var/log/nginx/error.log", "/var/log/nginx/api.*vpdb.io-error.log", "/var/log/nginx/storage-api.*vpdb.io-error.log", "/var/log/nginx/storage.*vpdb.io-error.log", "/var/log/nginx/www.*vpdb.io-error.log" ]
```

Note that we have two storage logs, one for that static public folder 
(`storage`), and one for the Node.js backend (`storage-api`).

### Logstash

Logstash does a few things here:

- Parse the JSON message to structured data 
- Add GeoIP data based on the IP address
- Resolve user agent strings to searchable browser fields
- Resolve the remote IP to the host name
- Override date and message by the one provided in the JSON
- Add a `fileset.app` field that tells us who logged the document
- Add a `fileset.name` and `fileset.module` to VPDB's documents

Since we're getting all other kinds of data from Logstash, we only apply those
filters based on the tags. 


### Elasticsearch

What ends up in Elasticsearch is an object like that:

```json
{
  "_index": "filebeat-2018.08.15",
  "_type": "doc",
  "_id": "2LQeP2UBXo1I82pL0bb2",
  "_version": 1,
  "_score": null,
  "_source": {
    "@timestamp": "2018-08-15T19:44:59.166Z",
    "vpdb": {
      "response": {
        "status": 200,
        "size": 9397,
        "duration": 217,
        "cached": true
      },
      "access": {
        "geoip": {
          "latitude": 47.1449,
          "location": {
            "lon": 8.1551,
            "lat": 47.1449
          },
          "country_code3": "CH",
          "country_code2": "CH",
          "longitude": 8.1551,
          "country_name": "Switzerland",
          "continent_code": "EU",
          "ip": "1.2.3.4",
          "timezone": "Europe/Zurich"
        }
      },
      "tokenType": "jwt-refreshed",
      "user": {
        "name": "freezy",
        "email": "freezy@vpdb.io",
        "id": "e2vue3x1"
      },
      "request": {
        "host": "1.2.3.4.fiber7.init7.net",
        "path": "/api/v1/games/lotr",
        "id": "QlG5yGMjvY",
        "ip": "1.2.3.4",
        "method": "GET"
      }
    },
    "offset": 202947,
    "fileset": {
      "module": "vpdb",
      "name": "access",
      "app": "api"
    },
    "source": "/var/www/server/production/shared/logs/vpdb-api.json.log",
    "log_level": "info",
    "host": {
      "name": "vpdb.io"
    },
    "prospector": {
      "type": "log"
    },
    "input": {
      "type": "log"
    },
    "@version": "1",
    "tags": [
      "beats_input_codec_plain_applied"
    ],
    "beat": {
      "name": "vpdb.io",
      "version": "6.3.2",
      "hostname": "vpdb.io"
    },
    "message": "GET /api/v1/games/lotr [200]",
    "env": "staging"
  },
  "fields": {
    "@timestamp": [
      "2018-08-15T19:44:59.166Z"
    ]
  },
  "sort": [
    1534362299166
  ]
}
```
