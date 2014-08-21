# vpdb
*A database for VP10 tables.*

[![Build Status](https://travis-ci.org/freezy/node-vpdb.svg?branch=master)](https://travis-ci.org/freezy/node-vpdb)
[![Coverage Status](http://img.shields.io/coveralls/freezy/node-vpdb/master.svg)](https://coveralls.io/r/freezy/node-vpdb)
[![Dependencies](https://david-dm.org/freezy/node-vpdb.svg)](https://david-dm.org/freezy/node-vpdb)


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

## Status

See [changelog](CHANGELOG.md).

## Installation

Prerequisites:

* Download and install [GraphicsMagick](http://www.graphicsmagick.org/) and make sure that the binary is in your `PATH`.
* Download and install [pngquant](http://pngquant.org/) and make sure that the binary is in your `PATH`.
* Download and install [OptiPNG](http://optipng.sourceforge.net/) and make sure that the binary is in your `PATH`.
* Download and extract [Libav](https://libav.org/download.html) and make sure that the binaries are in your `PATH`.
* Install the Grunt command line tool: `npm install -g grunt-cli`
* Download and install [Redis](http://redis.io/). *Windows*: Get binary [here](https://github.com/MSOpenTech/redis/tree/2.8/bin/release),
  extract it to somewhere, open an admin shell and run `redis-server --service-install redis.windows.conf --loglevel verbose --maxheap 500m`
  for a local dev setup.

Install Node.js and Git, then open a command line and type:

	git clone https://github.com/freezy/node-vpdb.git
	cd node-vpdb
	npm install
	bower install
	grunt build
	grunt serve

Open your browser and connect to `http://localhost:3000/`. There are some command line arguments you can supply:

 * `--port=<port>` - Makes the app listen on a given port. Default: `3000`.
 * `--config=<path>` - Uses a different settings file. Note that the settings location has different defaults depending 
   on how Grunt is launched:
   * When launched as `dev` or `serve`, the default is `server/config/settings.js`
   * When launched as `test` or `serve-test`, the default is `server/config/settings-test.js`. See *Tests* under 
     *Development* below for additional parameters.

Note that both settings may also be provided by setting the `PORT` and `APP_SETTINGS` environment variable (providing
it via command line arguments will override the though).

If you plan to setup a production environment from scratch, see the [Installation Guide](INSTALL.md).

## Development

While developing, you probably want to have your assets recompile automatically and re-launch the server if server code
was changed. In order to do that, launch the server in *development mode* by typing `grunt dev`, which will:

 * Compile all `.styl` stylesheets to `.css` and regenerate the style guide when a stylesheet changes
 * Regenerate the style guide when a style guide template changes
 * Restart the server when server code changes
 * Trigger a [Livereload](http://livereload.com/) event on any of the above
 
### Grunt Task Overview

Here are the relevant Grunt tasks:

| Task         | Description                         | Notes                                                                                                         |
|--------------|-------------------------------------|---------------------------------------------------------------------------------------------------------------|
| `build`      | Builds assets for production        | Compiles and minifies styles, minifies client-side scripts, generates style guide, renders static error pages |
| `serve`      | Launches server in production mode  | Serves minified styles and scripts                                                                            |
| `dev`        | Launches server in development mode | Recompiles assets on the fly, restarts server on code change and live-reloads the browser                     |
| `serve-test` | Launches server in test mode        | Enables code coverage and watches for server changes                                                          |
| `test`       | Runs API tests                      | Server must be running as `serve-test`                                                                        |

For the server tasks, we have:

|              | Assets Minified | Coverage Enabled | Automatic Asset Compilation | Linted | Config    |
|--------------|-----------------|------------------|-----------------------------|--------|-----------|
| `serve`      | yes             | no               | no                          | no     | *default* |
| `dev`        | no              | no               | yes                         | yes    | *default* |
| `serve-test` | no              | yes              | no                          | yes    | *test*    |


### Tests

A test run requires a clean environment. For this purpose, there is an included settings file at 
`server/config/settings-test.js` which is used when running tests. Basically it's a stripped-down config that uses a 
different database, runs on a different HTTP port and enable code coverage. 
 
If you want to run the tests, you'll need to open up two shells. In the first shell, run the server in test mode:

	grunt serve-test
	
In the second shell, run the API tests:

	grunt test --force
	
The `--force` parameter is necessary if you want to keep watching files for changes even though tests fail. There are
some additional command-line parameters:

 * `--server=<url>` - Server URL. Default: `http://localhost:7357/`.
 * `--basic-auth=<user>:<password>` - Adds a basic authentication header to every request.
 * `--auth-header=<header>` - Authorization header. Default: `Authorization`.

When running in test mode, a local test coverage report is available under [/coverage](http://localhost:7357/coverage/).

### Code Quality

When running the server in development or test mode, the code is linted using [JSHint](http://www.jshint.com/about/). If
the code doesn't pass, tests fail. You can run the linting manually with the `jshint` task.

As you can see by the badge on top of this README, continuous integration is set up using 
[Travis CI](https://travis-ci.org/freezy/node-vpdb) and [Codeship](https://www.codeship.io/). After every test run, code
coverage stats are sent to [Coveralls.io](https://coveralls.io/r/freezy/node-vpdb). Note that both CI and code coverage 
only concern server-side code.

## Credits

* To Mukuste. He gave the community such a nice momentum and I thought I could add a little bit to it.
* To Tom for his support of this project and a certainly awesome PinballX integration!

## License

GPLv2, see [LICENSE](LICENSE).