---
title: API
template: page.jade
menuIndex: 1
subsectionIndex: 1
---

## Security

The VPDB API is partly publicly available, partly restricted to logged users 
and partly restricted to users with a certain role.


### Authentication

Public resources don't need any further authentication, you can access them 
directly:

	curl https://vpdb.ch/api/ping

Restricted resources however need an access token. VPDB authenticates using 
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

See also article [here][blog-ng-jwt] and [here][blog-token-vs-cookies].

In order to get a token, you need to post your credentials to this resource:

	POST https://vpdb.ch/api/authenticate
	
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
	    "email": "test@test.com",
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

	GET https://vpdb.ch/api/user
	
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


### Authenticate with a Third Party Using OAuth2

You can also obtain a token by authenticating against GitHub or IP.Board. In
this case, you should point your browser to the redirection URL, e.g.
`https://vpdb.ch/auth/github`, which will redirect the user to GitHub, where he
can confirm authorization request. On success, GitHub will redirect the user 
back to your site with an access token. That access token can be used by the 
API to obtain an authorization token:

	GET https://vpdb.ch/api/authenticate/github?code=0123456789abcdef0123

Which returns the same response as `/api/authenticate` would have, including
an access token.


### Authorization

Some resources are more heavily protected than others, meaning you need a 
special role to access it. Here's a table of the resources and roles you'll 
need to access them.

|                     | `GET`       | `POST`      | `PUT`       | `HEAD` |
|---------------------|-------------|-------------|-------------|--------|
| `/api/authenticate` |             | *anon*      |             |        |
| `/api/users`        | admin       | *anon*      |             |        |
| `/api/users/:id`    |             |             | admin       |        |
| `/api/user`         | *logged*    |             |             |        |
| `/api/roles`        | admin       |             |             |        |
| `/api/ipdb/:id`     | contributor |             |             |        |
| `/api/files`        |             |             | contributor |        |
| `/api/games`        |             | contributor |             |        |
| `/api/games/:id`    |             |             |             | *anon* |
| `/api/ping`         | *anon*      |             |             |        |

To be updated for next bunch of resources.


### Rate Limit

The API currently doesn't have an enforces rate limit (in production, there
will be IP-based limiting by NGINX). However, quotas will be applied on the
storage API.

[jwt]: http://tools.ietf.org/html/draft-ietf-oauth-json-web-token
[blog-ng-jwt]: https://auth0.com/blog/2014/01/07/angularjs-authentication-with-cookies-vs-token/
[blog-token-vs-cookies]: https://auth0.com/blog/2014/01/27/ten-things-you-should-know-about-tokens-and-cookies/