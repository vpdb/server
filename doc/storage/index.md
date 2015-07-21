---
title: Storage API
header: Storage API
template: page.jade
menuIndex: 1
subsectionIndex: 1
---

# Overview

Although storage is handled by the same server as rest of the code, we keep the
**API** of the storage features separate from the rest. The reason is mainly
being able to easily offload storage to a different server in the future if
necessary without having to change the API.

# Downloading from Storage

In order to download a file, use the [storage resource][download]. All you need is
the storage ID of the item to download. However, for accessing non-public files,
authentication is needed as described below.

## Authentication

There are protected and unprotected storage items. Unprotected (or *free*)
items don't need authentication and can be downloaded anonymously. Such items
are thumbnails and text files and aren't part of the rate limiting either.

Then there are items that need authentication but don't count in the rate limit,
such as owned files or full-res images.

Finally, there are files which are protected and additionally restricted by the
rate limit, such as table downloads or any other larger files.

## Tokens

In order to access protected files, an authentication token must be provided in
the request. Depending on the type of token, it can be provided through the
HTTP header or as a query parameter. See [Authentication](/api/authentication)
of the core API.

### Storage Tokens

Storage tokens are short-lived tokens that can be provided in the URL and that
are locked to a given path. They can be used if the browser or any other client
that can't be set to use custom headers in order to download a file.

In order to obtain a storage token, use the [/authenticate][storage-token]
resource. You can request multiple tokens for multiple paths if necessary. When
requesting a storage token, either a JTW or an application token must be used:

```http
POST /storage/v1/authenticate HTTP/1.1
Host: vpdb.io
Accept-Encoding: gzip, deflate
Authorization: Bearer c87d59df0afa13684f010d3e50609cb8
Content-Type: application/json
Content-Length: 44

{
  "paths": "/storage/v1/files/EJ6eemf54Y.vpt"
}
```
Which results in a response such as:

```http
200 OK
Content-Type: application/json; charset=utf-8
Content-Length: 294
Etag: W/"126-piMotjOupW1C6seU0LHIyw"

{
  "/storage/v1/files/EJ6eemf54Y.vpt": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJFeVhlUXo5NEYiLCJpYXQiOiIyMDE1LTA3LTE5VDEzOjE1OjQzLjcyOVoiLCJleHAiOiIyMDE1LTA3LTE5VDEzOjE2OjQzLjcyOVoiLCJwYXRoIjoiL3N0b3JhZ2UvdjEvZmlsZXMvRUo2ZWVtZjU0WS52cHQifQ.xFBtcmP2dlMz1rc6yeQZmA_Y4MxDidu_rwaRXDmZWsU"
}
```

Using the received token, the file can then be retrieved:

```http
GET /storage/v1/files/EJ6eemf54Y.vpt?token=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJFeVhlUXo5NEYiLCJpYXQiOiIyMDE1LTA3LTE5VDEzOjE1OjQzLjcyOVoiLCJleHAiOiIyMDE1LTA3LTE5VDEzOjE2OjQzLjcyOVoiLCJwYXRoIjoiL3N0b3JhZ2UvdjEvZmlsZXMvRUo2ZWVtZjU0WS52cHQifQ.xFBtcmP2dlMz1rc6yeQZmA_Y4MxDidu_rwaRXDmZWsU HTTP/1.1
Host: vpdb.io
Accept-Encoding: gzip, deflate
```


[download]: api://storage/get/files/{storage_id}
[storage-token]: api://storage/post/authenticate
