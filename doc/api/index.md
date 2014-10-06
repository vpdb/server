---
title: Overview
template: page.jade
menuIndex: 1
subsectionIndex: 1
---

The API provides full access to VPDB's business logic. In fact, the web 
application relies 100% on the API and doesn't get any data from elsewhere, 
like rendered in the DOM or Javascript.


# Schema

The root of the API is the following:

	https://vpdb.ch/api

Only HTTPS is allowed. Data is sent and received in JSON, so unless specified 
otherwise, requests and responses should contain the 
`Content-Type: application/json` header.


# Response Verbosity

When returning data, there are different representations depending on whether a
list or a single item is returned. Additionally, sometimes the role of the 
authenticated user is decisive as well.
 
Generally, when requesting an individual resource, a *detailed representation*
is returned. For example, when [requesting your own user profile][api-profile],
you'll receive all available fields including your permissions:

	GET /api/user HTTP/1.1

However, when [retrieving a list of users][api-users], only a subset of fields
are returned:

	GET /api/users HTTP/1.1

This *summary representation* is due to a few reasons. First of all, the 
physical payload for some resources would grow immensely if details were 
returned for every item of a list. Secondly, some attributes are 
computationally expensive for the API to provide and are therefore omitted in
lists for performance reasons. And lastly, clients rarely need detailed data in
list anyway, so the effort would be mostly to no end.


# Authentication

As a [stateless][stateless] API, *token-based authentication* is used over 
cookie-based authentication. Authentication tokens can be obtained using the 
[authentication resource][api-auth]. For more details, read the
[authentication section][auth].

# Authorization

Access control is done by assigning *permissions* to a given *role*. A user can
have one or multiple roles. Roles also inherit from each other, e.g. the 
`ADMIN` role is parent of the `MEMBER` role, meaning it inherits all the 
permissions from `MEMBER`.

In order to grant permission to a given resource, the user must have a role
whose permissions match the permission of the resource. For example, in order
to access the [game creation resource][api-game-add], a client's role must 
include the `games/add` permission.

We try to keep the number of roles low and the number of permissions high. This
makes it flexible and easy to maintain. In the API, a user can retrieve the
permissions by [accessing the profile][api-profile], and UI elements should be 
toggled based on that (as opposed to checking the role, which is prone to 
changes).

In the API documentation, you'll see several icons indicating the role that is 
necessary for accessing the resource (hovering over it usually reveals more 
information):

| Icon                                            | Role          | Description
|-------------------------------------------------|---------------|------------
| <i class="icon icon-globe color-primary"></i>   | Anonymous     | These are non-authenticated users.
| <i class="icon icon-user color-primary"></i>    | Member        | Registrated users. Must be authenticated but don't have any other special role.
| <i class="icon icon-diamond color-primary"></i> | Contributor   | Contributors are the moderators of VPDB that have write access to most data.
| <i class="icon icon-badge color-primary"></i>   | Administrator | Administrators manage users and have write access to most user data.
| <i class="icon icon-crown color-primary"></i>   | Root          | The super user that manages the administrators or anything else.


# Errors

There are two different error response bodies. The first one indicates a 
general error with your request. This type of error contains a JSON object with
only an `error` property containing a string describing the error. It also 
comes with a `4xx` (or `500`) status code, hinting the type of error.

For example, posting invalid JSON results in 

	400 Bad Request
	Content-Length: 54
	Content-Type: application/json; charset=utf-8
	
	{
		"error": "Parsing error: Unexpected end of input"
	}

Or, accessing a protected resource without autorization header:

	401 Unauthorized
	Content-Type: application/json; charset=utf-8
	Content-Length: 79
	Etag: W/"4f-80cf3c5e"
	
	{
		"error": "Unauthorized. You need to provide credentials for this resource"
	}

The second type are *validation errors*. They come with a 
`422 Unprocessable Entity` status code and the response body contains an 
`errors` property containing *a list of errors*:

	422 Unprocessable Entity
	Content-Type: application/json; charset=utf-8
	Content-Length: 135
	
	{
		"errors": [
			{
				"message": "Email must be in the correct format.",
				"field": "email",
				"value": "xxx"
			}
		]
	}

# Pagination

# Dates

# Caching



[api-users]: api://core/get/users
[api-auth]: api://core/authenticate
[api-profile]: api://core/get/user
[api-game-add]: api://core/post/games
[auth]: /api/authentication
[stateless]: http://en.wikipedia.org/wiki/Stateless_protocol