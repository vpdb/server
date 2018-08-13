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
  "time": "2018-08-13T21:43:54.160Z",
  "level": "info",
  "request": {
    "id": "Re2HSIMLkS",
    "ip": "1.2.3.4"
  },
  "module": "Strategy.authenticate",
  "message": "Successfully authenticated with user <freezy@vpdb.io>.",
  "type": "app"
}
```

HTTP requests get logged in a similar way:

```json
{
  "time": "2018-08-13T21:43:54.491Z",
  "level": "info",
  "request": {
    "id": "KXnIPp7iA7",
    "ip": "1.2.3.4",
    "method": "GET",
    "path": "/api/v1/games?per_page=8&sort=popularity"
  },
  "user": {
    "id": "e2vue3x1",
    "email": "freezy@vpdb.io",
    "name": "freezy"
  },
  "tokenType": "jwt",
  "type": "access",
  "message": "GET /api/v1/games?per_page=8&sort=popularity [200]",
  "response": {
    "status": 200,
    "duration": 40,
    "size": 15310,
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
    - /path/to/vpdb.json.log
  tags: ["vpdb", "json"]
  fields:
    env: "production"
output.logstash:
  hosts: ["logstashserver:5044"]
  ssl.certificate_authorities: ["/path/to/cert.crt"]
  ssl.certificate: "/path/to/cert.crt"
  ssl.key: "/path/to/cert.key"    
```

This sends each line as-is to Logstash, tags it as "json" and adds an `env` 
field so we can easily filter between the different environments.

### Logstash

Logstash does a few things here:

- Parse the JSON message to structured data 
- Add GeoIP data based on the IP address
- Override date and message by the one provided in the JSON

Since we're getting all other kinds of data from logstash, we only apply those
filters based on the tags. The filter configuration looks like this:

```
filter {
  if "json" in [tags] {
    json {
      source => "message"
      target => "fields"
    }
    if "vpdb" in [tags] {
      geoip {
        source => "[fields][request][ip]"
        target => "geoip"
      }
      date {
        match => [ "[fields][time]", "ISO8601" ]
        remove_field => [ "[fields][time]" ]
      }
      mutate {
        copy => { "[fields][message]" => "message" }
        remove_field => [ "[fields][message]" ]
      }
    }
  }
}
```

### Elasticsearch

What ends up in Elasticsearch is an object like that:

```json
{
  "_index": "filebeat-2018.08.13",
  "_type": "doc",
  "_id": "6Q4-NWUBztgfEYDw3nwa",
  "_version": 1,
  "_score": null,
  "_source": {
    "offset": 27186,
    "@version": "1",
    "beat": {
      "name": "vpdb.io",
      "version": "6.3.2",
      "hostname": "vpdb.io"
    },
    "input": {
      "type": "log"
    },
    "host": {
      "name": "vpdb.io"
    },
    "fields": {
      "tokenType": "jwt",
      "request": {
        "id": "KXnIPp7iA7",
        "path": "/api/v1/games?per_page=8&sort=popularity",
        "method": "GET",
        "ip": "1.2.3.4"
      },
      "response": {
        "duration": 40,
        "size": 15310,
        "status": 200,
        "cached": true
      },
      "level": "info",
      "user": {
        "id": "e2vue3x1",
        "name": "freezy",
        "email": "freezy@vpdb.io"
      },
      "type": "access"
    },
    "message": "GET /api/v1/games?per_page=8&sort=popularity [200]",
    "tags": [
      "vpdb",
      "json",
      "beats_input_codec_plain_applied"
    ],
    "source": "/var/logs/vpdb-api.json.log",
    "prospector": {
      "type": "log"
    },
    "geoip": {
      "country_name": "Switzerland",
      "country_code3": "CH",
      "longitude": 1.0000,
      "ip": "1.2.3.4",
      "location": {
        "lon": 1.0000,
        "lat": 1.0000
      },
      "timezone": "Europe/Zurich",
      "continent_code": "EU",
      "country_code2": "CH",
      "latitude": 1.0000
    },
    "@timestamp": "2018-08-13T21:43:54.491Z"
  },
  "fields": {
    "@timestamp": [
      "2018-08-13T21:43:54.491Z"
    ]
  },
  "sort": [
    1534196634491
  ]
}
```
