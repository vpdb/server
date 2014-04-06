# vpdb
*A database for Visual Pinball X tables.*

## What is it?
A web application that makes downloading Visual Pinball tables as effective and pleasant as possible.
In a nutshell, it is:

* Well-structured
* Fast
* Easy on the eye

## Why is it better than what we have?

Contrarily to VPF and VPU that use a bulletin board solution with a downloads module, this was designed from scratch
specifically for a VPT database. It was also designed with the assumption that in VP10, there won't be any distinction
between any table formats anymore (FS vs Desktop). Also night/day mods are assumed to become parameters detached from
the individual tables.

### Data Structure

* We structure data by pinball tables. That means that every VPT release or any other download must be linked to a table,
even original table releases. So when we display details of a pinball table, we can list all releases for that table
plus any other download available linked to that table.
It also means that once you've found the table you were looking for, you only see downloads related to that table and
no other hits polluting your search results.

* Things like authors, acknowledgements, changelogs and mods are structured. That means that stats can pulled from those,
like most active releases, most acknowledged people, most modded tables etc.

* Media is divided in two types: Release-specific media (basically everything playfield related) and table-specific media
(backglasses, flyers, instruction cards etc). Release-specific media is obviously linked to the corresponding release so
you don't need to figure out which playfield videos work with which release.

### Browsing Experience

Browsing should be as effective as possible. For example, when typing a search query, results are filtered in real-time
and a [fuzzy search](http://en.wikipedia.org/wiki/Approximate_string_matching) algorithm is used so you'll find
*The Addams Family* even when typing *Adams Family*.

To make it even faster, network traffic is kept to a minimum. HTML templates are only loaded once and data is transferred
separately and asynchronously.

### User Interface

In general, using a low-contrast dark color scheme fatigues the reader's eye as little as possible. When browsing tables,
we make prominent use of the available media, while giving the user the possibility to switch to less media-oriented views
as well.

The interface is simple, clear and to the point. Downloads start with one click. There are subtle animations for most
actions or view transitions. Browsing should be a smooth and pleasing experience.

## Technology Stack

Server side runs on Node.js with Express, Stylus and Jade. Client uses AngularJS.

## Installation

Install Node.js and git, then open a command line and type:

	git clone https://github.com/freezy/node-vpdb.git
	cd node-vpdb
	npm install
	node app

Open your browser and connect to ``http://localhost:3000/``.

## Status

All this is currently a mock only. That means there is no database and all data/media is static. Obviously no download
works. Table data is only available in **Monster Bash** and some in **Attack from Mars**, the other tables are only
there to show how lists render.

I will soon gather some feedback and if there's interest, this could be the base of the next download platform for VP
tables.

## Credits

To Mukuste. He gave the community such a nice momentum and I thought I could add a little bit to it.

## License

GPLv2, see LICENSE.