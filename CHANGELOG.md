# VPDB Changelog

## v0.0.7 (unreleased)

*Client Changes*:

* Added email confirmation when registering locally
* Added release inline editing (WIP)
* Added user stats to profile page
* Added table name of zip file config to profile
* New home page, featuring:
  * FAQ
  * Game search
  * Latest releases
* Game list filters, sorting and paging is now persisted in URL
* Download button when not logged are managed properly with resume after logging or registering
* Added UI to ROM upload and listing
* Added UI to release comments and listing


*Server Changes*:

* Added user profile updates:
  * Local account creation for users logged via OAuth2
  * Public profile data (added location)
  * Password change
* User updates result in a log entry (user log)
* Added release comments
* Added counters
* Added ROMs support
* Concurrency fixes when running on a cluster
* Added game rating support

## v0.0.6

*Client Changes*:

* Added page for adding a new release
* Games list and game details aren't mocked anymore
* Markup is now 100% static while all data comes from API
* Added release details
* Release download (incl artwork) is working

*Server Changes*:

* API:
  * Games resource (`list`, `view`, `delete`)
  * Release resource (`create`, `delete`)
  * Tag resource (`create`, `list`, `delete`)
  * VP build resource (`create`, `list`)
  * Refactored storage API
* Added automatic thumbnail generation on file upload
* Added sample data generation when starting the first time
* Added Mongoose plugin for automatically referencing files
* Added FFmpeg integration for video transcoding
* Switched to Redis for ACLs, message queue, user dirty header and quota
* Added Continuous Integration on Travis CI and Codeship
* Separated application logic from client, web app is now 100% static
* Added first version of the developer site
* Started replacing icon font with SVG map
* Switched to short-time token for URL-based tokens
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
