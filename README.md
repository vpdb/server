# vpdb
*A database for VP10 tables.*

Live demo [here](http://vpdb.ch/).

## What is it?
A web application that makes downloading Visual Pinball tables as effective and pleasant as possible.
In a nutshell, it is:

* Well-structured
* Fast
* Easy on the eye
* Accessible via an API

## Why is it better than what we have?

Contrarily to VPF and VPU that use a bulletin board solution with a downloads module, this was designed from scratch
specifically for its purpose. It was also designed with the assumption that in VP10, there won't be any distinction
between table orientation anymore (FS vs Desktop). Additionally, night/day mods are assumed to become parameters
detached from the individual tables as well.

### Data Structure

* We structure data by pinball game. That means that every VPT release or any other download must be linked to a game,
even original table releases. Thus, when we display details of a pinball game, we can list all releases for that game
along with any other download linked to it.
It also means that once you've found the game you were looking for, you will only see downloads related to that table
and no other hits polluting your search results.

* Data like authors, acknowledgements, changelogs and mods are structured. That means that stats can pulled from those,
like most active releases, most acknowledged people, most modded tables or whatever else you would think of.

* Media is divided into two types: Release-specific media (basically everything playfield related) and game-specific
media (backglasses, flyers, instruction cards etc). Release-specific media is obviously linked to the corresponding
release so you don't need to figure out which playfield videos go with which release.

### Browsing Experience

Browsing should be as effective as possible. For example, when typing a search query, results are filtered in real-time
and a [fuzzy search](http://en.wikipedia.org/wiki/Approximate_string_matching) algorithm is used so you'll find
*The Addams Family* even when typing *Adams Family*.

To make it even faster, network traffic is kept to a minimum. HTML templates are only loaded once and data is transferred
separately and asynchronously.

### User Interface

The low-contrast dark color scheme fatigues the reader's eye as little as possible. When browsing tables, we make
prominent use of the available media, while giving the user the possibility to switch to less media-oriented views as
well.

The interface is simple, clear and to the point. Downloads start with one click. There are subtle animations for most
actions or view transitions. Browsing should be a smooth and pleasing experience.

### API

The REST API provides all the necessary data for the browser. Additionally, this API could be used by other clients. For
example it's imaginable that Hyperpin (or more likely the excellent [PinballX](http://www.pinballx.net/)) would pull
table updates and media directly from the API in an automated way.

## Technology Stack

Server runs on Node.js with Express, Stylus and Jade. Client uses AngularJS with CSS based on Twitter Bootstrap.

## Installation

Prerequisites:

* Download and install [GraphicsMagick](http://www.graphicsmagick.org/) and make sure that the binary is in
  your ``PATH``.

Install Node.js and git, then open a command line and type:

	git clone https://github.com/freezy/node-vpdb.git
	cd node-vpdb
	npm install
	node app

Open your browser and connect to ``http://localhost:3000/``.

If you're deploying to a remote service like OpenShift that doesn't have GraphicsMagick installed, SSH into your app
and type:

	mkdir $OPENSHIFT_DATA_DIR/src
	cd $OPENSHIFT_DATA_DIR/src
	wget ftp://ftp.graphicsmagick.org/pub/GraphicsMagick/1.3/GraphicsMagick-1.3.19.tar.gz
	tar xvfz GraphicsMagick-1.3.19.tar.gz
	cd GraphicsMagick-1.3.19
	./configure --prefix=$OPENSHIFT_DATA_DIR
	make && make install

In OpenShift's case, there's pre-build script which links the ``gm`` executable to Node.js' binary folder which is part
of the app's ``$PATH`` variable.

## Status

All this is currently a mock only. That means there is no database and all data/media is static. Obviously no download
works. Table data is only available in **Monster Bash** and some in **Attack from Mars**, the other tables are only
there to demonstrate how lists are displayed.

I will soon gather some feedback and if there's interest, this could be the base of the next generation download
platform for VP tables.

## Credits

To Mukuste. He gave the community such a nice momentum and I thought I could add a little bit to it.

## License

GPLv2, see LICENSE.