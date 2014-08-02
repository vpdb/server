# vpdb
*A database for VP10 tables.*

[![Build Status](https://travis-ci.org/freezy/node-vpdb.svg?branch=master)](https://travis-ci.org/freezy/node-vpdb) [![Coverage Status](https://coveralls.io/repos/freezy/node-vpdb/badge.png?branch=coverage)](https://coveralls.io/r/freezy/node-vpdb?branch=coverage) [![Dependency Status](https://gemnasium.com/freezy/node-vpdb.svg)](https://gemnasium.com/freezy/node-vpdb)


## What is it?
A free and open source web application that makes downloading Visual Pinball tables as effective and pleasant as 
possible. In a nutshell, it is:

* Well-structured
* Fast
* Easy on the eye
* Accessible via an API

## Why is it better than what we have?

Contrarily to VPF and VPU that use a bulletin board solution with a downloads module, this was designed from scratch
specifically for its purpose. That allows us to properly structure the data, make use of clever search algorithms
and pull interesting stats out of user interactions. Also we enjoy complete freedom over the UI, allowing us to 
streamline the user experience to the max.

### Data Structure

* We structure data by pinball game. That means that every VPT release or any other download must be linked to a game,
even original table releases. Thus, when we display details of a pinball game, we can list all releases for that game
along with any other download linked to it.
It also means that once you've found the game you were looking for, you will only see downloads related to that table
and no other hits polluting your search results.

* Data like authors, acknowledgements, changelogs and mods are structured. That means that stats can pulled from those,
like most active releases, most acknowledged people, most modded tables or whatever else you could think of.

* Media is divided into two types: Release-specific media (basically everything playfield related) and game-specific
media (backglasses, flyers, instruction cards etc). Release-specific media is obviously linked to the corresponding
release so you don't need to figure out which playfield videos go with which release.

### Browsing Experience

Browsing should be as effective as possible. For example, when typing a search query, results are filtered in real-time
and a [fuzzy search](http://en.wikipedia.org/wiki/Approximate_string_matching) algorithm is used so you'll find
*The Addams Family* even when typing *Adams Family*.

To make it even faster, network traffic is kept to a minimum. HTML templates are only loaded once and data is 
transferred separately and asynchronously. Of course everything is minified and compressed for minimal transfer size.

### User Interface

The low-contrast dark color scheme is easy on the reader's eye and makes it comfortable to read. When browsing tables, 
we make prominent use of the available media, while giving the user the possibility to switch to less media-oriented 
views as well.

The interface is simple, clean and to the point. Downloads start with one click. There are subtle animations for most
actions or view transitions. Browsing should be a smooth and pleasing experience.

### API

The REST API provides all the necessary data for the browser. Additionally, this API could be used by other clients. For
example it's imaginable that Hyperpin (or more likely the excellent [PinballX](http://www.pinballx.net/)) would pull
table updates and media directly from the API in an automated way.

## Technology Stack

Server runs on [Node.js](http://nodejs.org/) with [Express](http://expressjs.com/), [Stylus](http://learnboost.github.io/stylus/)
and [Jade](http://jade-lang.com/). Client uses [AngularJS](https://angularjs.org/) with CSS based on 
[Twitter Bootstrap](http://getbootstrap.com/).

## Installation

Prerequisites:

* Download and install [GraphicsMagick](http://www.graphicsmagick.org/) and make sure that the binary is in
  your ``PATH``.
* Download and install [pngquant](http://pngquant.org/) and make sure that the binary is in
  your ``PATH``.
* Download and install [OptiPNG](http://optipng.sourceforge.net/) and make sure that the binary is in
  your ``PATH``.
* Install the Grunt command line tool: ``npm install -g grunt-cli``

Install Node.js and Git, then open a command line and type:

	git clone https://github.com/freezy/node-vpdb.git
	cd node-vpdb
	npm install
	grunt build
	grunt serve

Open your browser and connect to ``http://localhost:3000/``.

For live reload and automatic app restart while developing, open a shell and launch:

	grunt dev
	
There are some command line arguments you can supply:

 * `--port=<port>` - Makes the app listen on a given port. Default: `3000`.
 * `--config=<path>` - Uses a different settings file. This has different defaults depending on how Grunt is launched:
   * When launched as `dev` or `serve`, the default is `server/config/settings.js`
   * When launched as `test`, `test-client` or `test-server`, the default is `server/config/settings-test.js`. See 
     *Tests* below for additional parameters.

Note that both settings may also be provided by setting the `PORT` and `APP_SETTINGS` environment variable.
 
### Grunt Task Overview

Here's an overview how you can launch the server and what the different behaviors are:

|              | Assets Minified | Coverage Enabled | Automatic Asset Compilation | Config    |
|--------------|-----------------|------------------|-----------------------------|-----------|
| `serve`      | yes             | no               | no                          | *default* |
| `dev`        | no              | no               | yes                         | *default* |
| `serve-test` | no              | yes              | no                          | *test*    |

If you plan to setup a production environment from scratch, see the [Installation Guide](INSTALL.md).

## Status

See [changelog](CHANGELOG.md).

## Tests

The automated tests cover the API. A test run requires a clean environment. For this purpose, there is an included 
settings file at `server/config/settings-test.js` which is used when running tests. Basically it's a stripped-down 
config that uses a different database.
 
There are a few ways you can run tests:

 * `grunt test --force` - Fires up the test server and launches API tests. Re-runs tests when tests change and restarts server 
   and runs tests when server-code changes.
 * `grunt test-server` - Fires up the server with the test config. Restarts server when server-code changes.
 * `grunt test-client --force` - Runs tests and re-runs them if they change or server restarts.
   
The `test-client` goal accepts additional command-line parameters:

 * `--server=<url>` - Server URL for API integration tests. Default: `http://localhost:3000/`.
 * `--basic-auth=<user>:<password>` - Adds a basic authentication header to every request.
 * `--auth-header=<header>` - Authorization header. Default: `Authorization`.
 
The `--force` parameter is necessary if you want to keep watching files even when tests fail.

### JSHint

If you want to run the server code through JSHint, type `grunt jshint`.

## Credits

* To Mukuste. He gave the community such a nice momentum and I thought I could add a little bit to it.
* To Tom for his support of this project and a certainly awesome PinballX integration!

## License

GPLv2, see LICENSE.