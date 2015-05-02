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


# Restricted Resources

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

In order to obtain a token, you can either *locally* authenticate, which
checks a set of credentials against VPDB's local database, or you can
authenticate with a third party provider via OAuth2 such as GitHub or IP.Board
([where supported][ipb-oauth2]).

For third-party applications such as PinballX, you can create an [explicit
access token][api-token] that is manually managed, i.e. it doesn't time out 
until it's explicitly revoked.


## Local Authentication

In order to get a token, you need to post your credentials to 
[this resource][api-auth]:

	POST https://vpdb.ch/api/v1/authenticate
	
	{
	  "username": "<username>",
	  "password": "<password>"
	}
	
In return, you'll get the token along with your user profile:

	{
	  "token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpc3MiOiI1M2MyNTJkMThiNDcyMjdjMjZjZmUxYjgiLCJpYXQiOiIyMDE0LTA3LTEzVDA5OjM1OjE2LjQ0NloiLCJleHAiOiIyMDE0LTA3LTEzVDEwOjM1OjE2LjQ0NloifQ.8RyvT14Ga2gpfmiyVbx45RcqbFHxSgWjgC-4OaLh9Vc",
	  "expires": "2014-07-13T10:35:16.446Z",
	  "user": {
	    "_id": "53c252d18b47227c26cfe1b8",
	    "name": "test",
	    "username": "test",
	    "email": "test@vpdb.ch",
	    "plan": "unlimited",
	    "provider": "local",
	    "active": true,
	    "roles": [ "root" ],
	    "permissions": {
	      "roles": [ "*" ],
	      "users": [ "update", "list", "view" ],
	      "files": [ "upload", "download" ],
	      "ipdb": [ "view" ],
	      "games": [ "update", "add" ],
	      "user": [ "profile" ]
	    },
	    "rolesAll": [ "root" ]
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
inactivity.


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

JTWs are obtained using either a password or a web browser. For third-party
applications such as PinballX, this isn't optimal, since users would need to
give their password to the application which would store it somewhere in plain
text.

[Explicitly generated access tokens][api-token] go around this problem by 
providing a randomly generated string that can be easily revoked if lost. Once
created, such a token is valid for one year or until the user deletes it.

They work like JTWs and are provided by the client through the `Authorization` 
header:

	Authorization: Bearer 2c4e34e2f0e522c3149fe2c332d85f16


### Authorization

Some resources are more heavily protected than others, meaning you need a 
special role to access it. Here's a table of the resources and roles you'll 
need to access them.

|                        | `GET`       | `POST`      | `PUT`       | `HEAD` |
|------------------------|-------------|-------------|-------------|--------|
| `/api/v1/authenticate` |             | *anon*      |             |        |
| `/api/v1/users`        | admin       | *anon*      |             |        |
| `/api/v1/users/:id`    |             |             | admin       |        |
| `/api/v1/user`         | *logged*    |             |             |        |
| `/api/v1/roles`        | admin       |             |             |        |
| `/api/v1/ipdb/:id`     | contributor |             |             |        |
| `/api/v1/files`        |             |             | contributor |        |
| `/api/v1/games`        |             | contributor |             |        |
| `/api/v1/games/:id`    |             |             |             | *anon* |
| `/api/v1/ping`         | *anon*      |             |             |        |

To be updated for next bunch of resources.


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
[ipb-oauth2]: https://github.com/freezy/ipb-oauth2-server