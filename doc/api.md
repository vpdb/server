FORMAT: 1A
HOST: https://vpdb.gameex.com/api

# VPDB RESTful API
This is the API documentation for the [VPDB](https://github.com/freezy/node-vpdb)
platform. Note that the web application completly relies on this API, i.e.
there is no additional data exchange via the web server directly. This means
that the web application could be completely decoupled from the API.

## Approach
This is a pragmatic API. And some more explications.

## Authentication
About authentication

## Authorization
About authorization

## Quota
About quota and throttling

# Group Users
A *User* is you, the API client, or the person using it. The User resource
contains basic ``CRUD`` operations as well as resources for login and logout.

## User [/users/{id}]
Retrieve a single User.

+ Model

    + Headers

            Content-Type: application/json

    + Body

            {
                "username": "admin",
                "email": "admin@vpdb.ch",
            }

### Create New User [POST]
Used during the registration process. This is simple but will get full-fledged
CAPTCHA and email-confirmation support soon.

+ Parameters

    + username (required, string, `68a5sdf67`) ... A unique, alpha-numeric string identifying the user
    + email (required, string, `admin@vpdb.ch`) ... The email address of the user
    + password (required, string, `donotcopythis`) ... The user's password, at least 6 characters.

+ Request

    + Headers

            Content-Type: application/json

    + Body

            {
                "username": "admin",
                "email": "admin@vpdb.ch",
                "password": "foobar"
            }

+ Response 201

    + Headers

            Content-Type: application/json

    + Body
            {
                "_id": "5374a0f5c1a6c6901e9526cb",
                "name": "admin",
                "provider": "local",
                "username": "admin",
                "email": "admin@vpdb.ch",
                "active": true
            }

+ Response 422

    + Headers

            Content-Type: application/json

    + Body

           {
               "errors": [
                   {
                       "message": "Email must be in the correct format.",
                       "field": "email",
                       "value": "foobar"
                   }
               ]
           }
