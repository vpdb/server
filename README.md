![vpdb][text-logo]

*A database for Virtual Pinball tables.*

[![Build Status][travis-image]][travis-url]
[![Test Coverage][coveralls-image]][coveralls-url]
[![Dependencies][dependencies-image]][dependencies-url]

## What is it?

VPDB is an open platform where people can share their digital recreations of virtual pinball tables and everything else 
around virtual pinball. This is the server part of the platform, a.k.a the API. If you're looking for the web application,
it's [here](https://github.com/vpdb/website). 

## Stack

VPDB runs on a [Node.js](http://nodejs.org/) stack written in [TypeScript](https://www.typescriptlang.org/). The web 
framework is [koa](https://koajs.com/). Data comes from [MongoDB](https://www.mongodb.org/) and queues and caches are 
handled by [Redis](http://redis.io/).

## "Quick" Install

* Download and install [GraphicsMagick](http://www.graphicsmagick.org/), [pngquant](http://pngquant.org/),
  [OptiPNG](http://optipng.sourceforge.net/), [FFmpeg](https://www.ffmpeg.org/) and [Unrar](http://rarsoft.com/) and 
  make sure that the binaries are in your `PATH`.
* Install [MongoDB](http://www.mongodb.org/downloads) and [Redis](http://redis.io/). *Windows*: Get binary 
  [here](https://github.com/MSOpenTech/redis/tree/2.8/bin/release), extract it to somewhere, open an admin shell and 
  run `redis-server --service-install redis.windows.conf --loglevel verbose --maxheap 500m` for a local dev setup.

Install Node.js 8+ and Git, then open a command line and type:

	git clone https://github.com/vpdb/server.git vpdb-server
	cd vpdb-server
	npm install
	npm run serve:dev

That's it, the API should now be available. Retrieve tags:

	curl http://localhost:3000/api/v1/tags

For more detailed instructions, check out the [Installation Guide](INSTALL.md).

## Cool Stuff

- Data Structure
- Processors
- Table Blocks
- Realtime
- Caching

### Tests

There are 1000+ automated integration tests. It's best to use two terminals to run them:

- `npm run test:serve` - Runs the server in test mode
- `npm run test:run` - Runs the tests

For more info, see [tests](TESTS.md).

### Code Quality

When running the server in development or test mode, the code is linted using [JSHint](http://www.jshint.com/about/). If
the code doesn't pass, tests fail. You can run the linting manually with the `lint` task.

There's also continuous integration running on two services:

|           | Status                                                   |
|-----------|----------------------------------------------------------|
| Travis CI | [![Build Status Travis CI][travis-image]][travis-url]    |
| Codeship  | [![Build Status Codeship][codeship-image]][codeship-url] |

After every test run, code coverage stats are sent to [Coveralls.io](https://coveralls.io/r/vpdb/backend).

Code is also run through Code Climate, with the following result: [![Code Climate][codeclimate-image]][codeclimate-url]

## Credits

* To Mukuste. He gave the community such a nice momentum and I thought I could add a little bit to it.
* To Tom for his support of this project.

[![IntelliJ IDEA][idea-image]][idea-url]

Thanks also to JetBrains for their awesome IDE and support of the Open Source Community!

<a title="Realtime application protection" href="https://www.sqreen.io/?utm_source=badge"><img width="150" src="https://s3-eu-west-1.amazonaws.com/sqreen-assets/badges/20171107/sqreen-light-badge.svg" alt="Sqreen | Runtime Application Protection" /></a>

Finally, big shouts to Sqreen for their excellent security services protecting our host at vpdb.io!


## License

GPLv2, see [LICENSE](LICENSE).

[text-logo]: https://raw.githubusercontent.com/vpdb/server/master/assets/vpdb-logo-text.svg
[travis-image]: https://img.shields.io/travis/vpdb/server.svg?style=flat-square
[travis-url]: https://travis-ci.org/vpdb/server
[coveralls-image]: https://img.shields.io/coveralls/vpdb/backend.svg?style=flat-square
[coveralls-url]: https://coveralls.io/r/vpdb/backend?branch=master
[dependencies-image]: https://david-dm.org/vpdb/server.svg?style=flat-square
[dependencies-url]: https://david-dm.org/vpdb/server
[codeship-image]: http://img.shields.io/codeship/46408820-1c40-0134-d638-1a1dadf4f728.svg?style=flat-square
[codeship-url]: https://www.codeship.io/projects/159851
[codeclimate-image]: http://img.shields.io/codeclimate/github/vpdb/backend.svg?style=flat-square
[codeclimate-url]: https://codeclimate.com/github/vpdb/backend
[idea-image]: https://raw.githubusercontent.com/vpdb/server/master/assets/intellij-logo-text.svg
[idea-url]: https://www.jetbrains.com/idea/