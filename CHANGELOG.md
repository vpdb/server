# VPDB Changelog

## v0.0.6 (unreleased)

*Client Changes*:

* Added page for adding a new release
* Games list and game details aren't mocked anymore

*Server Changes*:

* API:
  * Tag resource (`create`, `list`)
  * VP build resource (`create`, `list`)
* Added automatic thumbnail generation on file upload
* Added sample data generation when starting the first time
* Added Mongoose plugin for automatically referencing files
* Added FFmpeg integration for video transcoding
* Switched to Redis for ACLs, message queue, user dirty header and quota
* Bugfixes

## v0.0.5

*Server Changes*:

* Updated API:
  * User resource (`authorize`)
* Switched from sessions to auth tokens on the API
* Added API integration tests
* Migrated to Express v4.x


## v0.0.4

*Client Changes*:

* Added login Form
* Added user management page
* Added page for adding new games

*Server Update:*

* Added [PassportJS](http://passportjs.org/) integration
* Added IP.Board integration via [OAuth2](https://github.com/freezy/ipb-oauth2-server).
* Added user registration and login
* Added admin interface for users
* Added "real" server-side API:
  * User resource (`create`, `list`, `update`, `login`, `logout`)
  * Roles resource (`list`)
  * Games resource (`create`)
  * IPDB resource (`get`)
  * Files resource (`upload`)
* Added storage API
* Added ACLs for permissions management to REST API
* Added basic quota management to storage API
* Moved from [Piler](https://github.com/epeli/piler) to [Grunt](http://gruntjs.com/) for asset compilation
* Restructured server code
* Added documentation and scripts for production deployment
* Rewrote all the CSS using KSS style sheets.


## v0.0.1

Initial Version, all data static and read-only

* Front page
  * Packs
  * Latest Releases
  * Time line
  * User stats
* List games (grid, extended, list)
  * Ordering on client side
  * Filtering on client side
* Game details with release data for Monster Bash
* Pin Downloads
* User details tooltip
