---
title: API Authentication
header: Authentication
template: page.jade
menuIndex: 1
subsectionIndex: 2
---

# Overview

The VPDB API is partly publicly available, partly restricted to logged users 
and partly restricted to users with a certain role.


# Public Resources

Public resources don't need any further authentication, you can access them 
directly:

	curl https://vpdb.ch/api/v1/ping


# Access Tokens

Restricted resources need an access token. VPDB authenticates using 
[JSON Web Tokens][jwt] via the `Authorization` header. Compared to other 
authentication schemes, this approach has several advantages:

 * Credentials are only sent once over the wire when requesting the token.
 * Token is self-containing, i.e. the server is not required to maintain
   a list of tokens and expire them; it only checks the signature and 
   accepts or drops.
 * Compared to cookie-based sessions, security problems related to cross
   site requests don't exist due to the nature of the non-persistent headers.
 * Easy non-browser implementation: Cookie or Simple HTTP-based 
   authentication is not ideal when working with native mobile clients or
   other non-browser based applications.

See also [these][blog-ng-jwt] [Articles][blog-token-vs-cookies] for more
information.

There are three different types of access tokens:

 1. **Primary Tokens** (or just **tokens**) are issued by the [`/authenticate`][api-auth]
    resource by providing a username or password. It is also possible to obtain
    one through OAuth2 remote authentication. They are valid a reasonable 
    amount of time (usually 15 minutes) and are used by the web client 
    accessing the API.
 2. **Storage Tokens** are issued by the [storage API][storage-auth] and can
    be used in the URL. However, they are valid only a short amount of time 
    (usually a minute) and are locked to a given path. Their goal is to provide
    a browser-friendly way access to protected assets.
 3. **Application Tokens** are issued by the [`/tokens`][api-token] resource.
    They are long lived (usually a year) and must be manually maintained. The
    goal of application tokens is permanent access to third party applications
    such as PinballX, without the need to hand over the user's password. 
    Contrarily to primary tokens and storage tokens, application tokens are no
    JWTs but only random strings.


## Local Authentication

When you register at VPDB, a local username and password is created. You can 
obtain a token by posting these credentials to the [`/authenticate`][api-auth]
resource:

	POST https://vpdb.ch/api/v1/authenticate
	
	{
	  "username": "<username>",
	  "password": "<password>"
	}
	
In return, you'll get the token along with your user profile:

	{
	  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJFMUM3OW5aQzR6IiwiaWF0IjoiMjAxNS0wNC0yNVQxODo1MzoxMy41MTVaIiwiZXhwIjoiMjAxNS0wNC0yNVQxOTo1MzoxMy41MTVaIn0.glHeiVVdEA_033hlj28JQyg5N2b77Ixy8estmKSTd3k",
	  "expires": "2015-04-25T19:53:13.515Z",
	  "user": {
	    "id": "E1C79nZC4z",
	    "name": "Adelle62",
	    "username": "Adelle62",
	    "gravatar_id": "bca1af083965ca485517333b6ca3e90b",
	    "email": "cade71@hotmail.com",
	    "is_active": true,
	    "provider": "local",
	    "roles": [ "member" ],
	    "plan": "free",
	    "created_at": "2015-04-25T18:53:13.435Z",
	    "counter": { "stars": 0, "downloads": 0, "comments": 0 },
	    "permissions": { 
	      "comments": [ "add" ],
	      "ratings": [ "view", "add", "update" ],
	      "tags": [ "add", "delete-own" ],
	      "games": [ "star" ],
	      "users": [ "search", "view" ],
	      "files": [ "upload", "delete", "download" ],
	      "releases": [ "delete", "add", "star" ],
	      "roms": [ "add", "delete-own" ],
	      "builds": [ "add", "delete-own" ],
	      "user": [ "view", "update", "star" ]
	    }
	  }
	}
	
The token should then be included as a bearer token in the `Authorization` 
header. For example, when retrieving the user profile, the client would send:

	GET /api/v1/user HTTP/1.1
	Accept: application/json
	Accept-Encoding: gzip, deflate
	Authorization: Bearer eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiI1M2MyNTJkMThiNDcyMjdjMjZjZmUxYjgiLCJpYXQiOiIyMDE0LTA3LTEzVDA5OjM1OjE2LjQ0NloiLCJleHAiOiIyMDE0LTA3LTEzVDEwOjM1OjE2LjQ0NloifQ.8RyvT14Ga2gpfmiyVbx45RcqbFHxSgWjgC-4OaLh9Vc
	Connection: keep-alive
	Host: vpdb.ch

A new token is valid for 15 minutes. After that, a new token must be generated.
However, a user might want to stay authenticated while browsing the site and 
not be forced to re-login every 15 minutes.

That's why for authenticated API calls, the API returns a new token in the 
`X-Token-Refresh` header. The client is free to use the new token for the next
request, resulting in the user having to relogin only after 15 minutes of 
*inactivity*.


## Remote Authentication with OAuth2

You can also obtain a token by authenticating against GitHub or IP.Board. In 
your web application flow, redirect the browser to the OAuth2 authorization 
page of the OAuth2 provider. In case the user allowed access to VPDB, the 
callback will contain a `code` parameter, which the web application can then
use to authenticate with [VPDB's API][api-auth-oauth2]:

	GET /api/v1/authenticate/github?code=0123456789abcdef0123 HTTP/1.1

Which returns the same response as `/api/authenticate` would have, including
an access token.


## Third Party Authentication

JWTs are obtained using either a password or a web browser. For third-party
applications such as PinballX, this isn't optimal, since users would need to
give their password to the application which would need to store it somewhere 
in plain text.

[Application access tokens][api-token] go around this problem by providing a 
randomly generated string that can be easily revoked if lost. Once created, 
such a token is valid for one year or until the user deletes or renews it.

Like JWTs, They are provided by the client through the `Authorization` header:

	Authorization: Bearer 2c4e34e2f0e522c3149fe2c332d85f16

### Rate Limit

The API currently doesn't have an enforces rate limit (in production, there
will be IP-based limiting by NGINX). However, quotas will be applied on the
storage API.


[jwt]: http://tools.ietf.org/html/draft-ietf-oauth-json-web-token
[blog-ng-jwt]: https://auth0.com/blog/2014/01/07/angularjs-authentication-with-cookies-vs-token/
[blog-token-vs-cookies]: https://auth0.com/blog/2014/01/27/ten-things-you-should-know-about-tokens-and-cookies/
[api-auth]: api://core/post/authenticate
[api-auth-oauth2]: api://core/post/authenticate/{provider_name}
[api-token]: api://core/post/tokens
[storage-auth]: api://storage/post/authenticate
[ipb-oauth2]: https://github.com/freezy/ipb-oauth2-server