![vpdb][text-logo]

*A database for Virtual Pinball tables.*

[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]
[![Dependencies][dependencies-image]][dependencies-url]

## What is it?

VPDB is a platform where people can share their digital recreations of virtual pinball tables. It's meant to be easy to
use, beautiful to look at and fast to browse. But most importantly, it will save you a huge amount of time when setting
up and maintaining your virtual cabinet (you'll actually get to play again).

## How does it work?

VPDB has three tiers:

1. The backend server, [powered by a nice API](https://developer.vpdb.io/api)
2. The web application
3. [A desktop application](https://github.com/freezy/vpdb-agent) for your cabinet

The backend server contains all the data and makes it accessible through the API. The web application shows off the data
and lets the user browse, comment, download and rate. The desktop application can subscribe to the content and update it
automatically, knowing the file structure of your cabinet.

## Why is it better than what we have?

Contrarily to VPF and VPU that use a bulletin board solution with a downloads module, this was designed and built 
entirely from scratch for its purpose. Data is [structured as it should be](https://developer.vpdb.io/api/v1/releases)
and we can do stuff a generic download solution just can't. Also we enjoy complete freedom over the UI, allowing to 
streamline the user experience to the max.

## Features

* Fast [fuzzy search](http://en.wikipedia.org/wiki/Approximate_string_matching)
* Distinction between fullscreen / desktop / universal (VPX) orientation is fully integrated
* Multiple releases per game
* Multiple versions per release, incl. changelog
* Multiple files per version - a version could cover both FS and DT - or VP9 and VPX - or any other combination
* Link compatible VP versions to a `.vpt` file
* Set orientation of a `.vpt` file
* Set lighting (day, night, linear) of a `.vpt` file
* Multiple authors per release
* All authors are owners of the release and can edit / update
* Acknowledgement field where other table contributors can be cross-linked
* Support for DirectB2S backglasses
* Many media types per file and game
* Multiple views when listing releases
* Fancy release upload form to make an author's life as easy as possible
* Automatic mod detection

## Tech Stack

Server runs on [Node.js](http://nodejs.org/) with [Express](http://expressjs.com/), [Stylus](http://learnboost.github.io/stylus/)
and [Jade](http://jade-lang.com/). [MongoDB](https://www.mongodb.org/) and [Redis](http://redis.io/) for data storage. 
Client uses [AngularJS](https://angularjs.org/) with CSS based on [Twitter Bootstrap](http://getbootstrap.com/).

## Quick Install

* Download and install [GraphicsMagick](http://www.graphicsmagick.org/), [pngquant](http://pngquant.org/),
  [OptiPNG](http://optipng.sourceforge.net/), [FFmpeg](https://www.ffmpeg.org/) and [Unrar](http://rarsoft.com/) and 
  make sure that the binaries are in your `PATH`.
* Install [MongoDB](http://www.mongodb.org/downloads) and [Redis](http://redis.io/). *Windows*: Get binary 
  [here](https://github.com/MSOpenTech/redis/tree/2.8/bin/release), extract it to somewhere, open an admin shell and 
  run `redis-server --service-install redis.windows.conf --loglevel verbose --maxheap 500m` for a local dev setup.
* Install Grunt: `npm install -g grunt-cli`

Install Node.js 6+ and Git, then open a command line and type:

	git clone https://github.com/freezy/node-vpdb.git
	cd node-vpdb
	npm install --msvs_version=2012
	bower install
	grunt build
	grunt serve

Open your browser and connect to [http://localhost:3000/](http://localhost:3000/). There are some command line arguments
you can supply:

 * `--port=<port>` - Makes the app listen on a given port. Default: `3000`.
 * `--config=<path>` - Uses a different settings file. Note that the settings location has different defaults depending 
   on how Grunt is launched:
   * When launched as `dev` or `serve`, the default is `server/config/settings.js`
   * When launched as `test` or `serve-test`, the default is `server/config/settings-test.js`. See *Tests* under 
     *Development* below for additional parameters.

Both settings may also be provided by setting the `PORT` and `APP_SETTINGS` environment variable (providing it via 
command line arguments will override).

For more detailed instructions, check out the [Installation Guide](INSTALL.md).

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

See [tests](TESTS.md).


### Code Quality

When running the server in development or test mode, the code is linted using [JSHint](http://www.jshint.com/about/). If
the code doesn't pass, tests fail. You can run the linting manually with the `jshint` task.

There's also continuous integration running on three services:

|           | Status                                                   |
|-----------|----------------------------------------------------------|
| Travis CI | [![Build Status Travis CI][travis-image]][travis-url]    |
| Codeship  | [![Build Status Codeship][codeship-image]][codeship-url] |

After every test run, code coverage stats are sent to [Coveralls.io](https://coveralls.io/r/vpdb/backend). Note that 
both CI and code coverage only concern server-side code.

Code is also run through Code Climate, with the following result: [![Code Climate][codeclimate-image]][codeclimate-url]

## Credits

* To Mukuste. He gave the community such a nice momentum and I thought I could add a little bit to it.
* To Tom for his support of this project.

[![IntelliJ IDEA][idea-image]][idea-url]

Thanks also to JetBrains for their awesome IDE and support of the Open Source Community!


## License

GPLv2, see [LICENSE](LICENSE).

[text-logo]: https://github.com/vpdb/backend/raw/master/gfx/text-logo.png
[travis-image]: https://img.shields.io/travis/vpdb/backend.svg?style=flat-square
[travis-url]: https://travis-ci.org/vpdb/backend
[coveralls-image]: https://img.shields.io/coveralls/vpdb/backend.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/vpdb/backend?branch=master
[dependencies-image]: https://david-dm.org/vpdb/backend.svg?style=flat-square
[dependencies-url]: https://david-dm.org/vpdb/backend
[codeship-image]: http://img.shields.io/codeship/46408820-1c40-0134-d638-1a1dadf4f728.svg?style=flat-square
[codeship-url]: https://www.codeship.io/projects/159851
[codeclimate-image]: http://img.shields.io/codeclimate/github/vpdb/backend.svg?style=flat-square
[codeclimate-url]: https://codeclimate.com/github/vpdb/backend
[idea-image]: https://raw.githubusercontent.com/vpdb/backend/master/gfx/logo_IntelliJIDEA.png
[idea-url]: https://www.jetbrains.com/idea/