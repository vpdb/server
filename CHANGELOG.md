# VPDB Changelog

## v0.0.2 (unreleased)

Server Update

* Added [PassportJS](http://passportjs.org/) integration
* Added IP.Board integration via [OAuth2](https://github.com/freezy/ipb-oauth2-server).
* Added user registration and login
* Added admin interface for users
* Added "real" server-side API:
  * User resource (``create``, ``list``, ``update``, ``login``, ``logout``)
  * Roles resource (``list``)
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
