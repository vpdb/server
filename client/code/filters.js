'use strict';

/* Filters */
var filters = angular.module('vpdb.filters', []);

/**
 * Formats a rating so it always displays one decimal.
 */
filters.filter('rating', function() {

	return function(rating) {
		rating = parseFloat(rating);
		if (!rating) {
			return ' — ';
		}
		if (Math.round(rating) == rating && rating < 10) {
			return rating + '.0';
		} else {
			return Math.round(rating * 10) / 10;
		}
	};
});

/**
 * Converts byte size into something more readable.
 */
filters.filter('bytes', function() {
	return function(bytes, precision) {
		if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) return '-';
		if (typeof precision === 'undefined') precision = 1;
		var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
			number = Math.floor(Math.log(bytes) / Math.log(1024));
		return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) +  ' ' + units[number];
	}
});

filters.filter('escape', function() {
	return window.escape;
});

filters.filter('mediatype', function(DisplayService) {
	return function(type) {
		return DisplayService.media(type);
	}
});

filters.filter('gametype', function() {
	return function(type) {
		if (type) {
			switch (type.toLowerCase()) {
				case 'ss':
					return 'Solid-State Game';
				case 'em':
					return 'Electro-Mechanical Game';
				case 'pm':
					return 'Pure Mechanical';
				case 'og':
					return 'Original Game';
				default:
					return type;
			}
		} else {
			return 'Undefined';
		}

	}
});

filters.filter('smalls', function() {
	return function(str) {
		return str.replace(/(\d\d\d0)s/i, "$1<small>s</small>");
	}
});

filters.filter('feedIcon', function() {
	return function(item) {
		switch (item.type) {
			case 'comment':
				return 'fa-comment';
			case 'release':
				return 'fa-arrow-circle-up';
			default:
				return '';
		}
	}
});

filters.filter('manufacturerIcon', function() {
	return function(item) {
		switch (item.logo) {
			case 'williams':
				return 'icon-williams';
			case 'stern':
				return 'icon-stern';
			default:
				return '';
		}
	}
});

filters.filter('feedAction', function() {
	return function(item) {

		switch (item.type) {
			case 'comment':
				return '&nbsp;commented on <a href="/game/' + item.data.game.id + '#' + item.data.release.id +'" class="a--lighter">'
					+ item.data.release.title
					+ '</a> of <a href="/game/' + item.data.game.id +'" class="a--lighter">'
					+ item.data.game.name
					+ '</a>';

			case 'release':
				return '&nbsp;released <a href="/game/' + item.data.game.id + '#' + item.data.release.id +'" class="a--lighter">'
					+ item.data.release.title
					+ '</a> <label class="label--version">' + item.data.release.lastversion.version + '</label>'
					+ ' of '
					+ '<a href="/game/' + item.data.game.id +'" class="a--lighter">'
					+ item.data.game.name
					+ '</a>';
			default:
				return '<i>Unknown event</i>';
		}
	}
});

filters.filter('feedMessage', function() {
	return function(item) {
		switch (item.type) {
			case 'comment':
				return item.data.message;

			case 'release':
				return 'Changelog here';
			default:
				return '<i>Unknown event</i>';
		}
	}
});

filters.filter('decade', function() {
	return function(items, decades) {
		if (!items || !decades || !decades.length) {
			return items;
		}
		return _.filter(items, function(game) {
			var decade;
			for (var i = 0; i < decades.length; i++) {
				decade = decades[i];
				if (game.year >= decade && game.year < (decade + 10)) {
					return true;
				}
			}
			return false;
		});
	}
});

filters.filter('manufacturer', function() {
	return function(items, manufacturers) {
		if (!items || !manufacturers || !manufacturers.length) {
			return items;
		}
		return _.filter(items, function(game) {
				var manufacturer;
				for (var i = 0; i < manufacturers.length; i++) {
				manufacturer = manufacturers[i];
				if (game.manufacturer.toLowerCase() == manufacturer.toLowerCase()) {
					return true;
				}
			}
			return false;
		});
	}
});


filters.filter('dlRelease', function() {
	return function(data) {
		var game = data[0];
		var release = data[1];
		return [ game.name, release.title ];
	}
});

filters.filter('dlRom', function() {
	return function(data) {
		var game = data[0];
		var rom = data[1];
		return [ game.name, 'ROM <samp>' + rom.name + '</samp>' ];
	}
});

filters.filter('dlBackglass', function() {
	return function(data) {
		var game = data[0];
		var backglass = data[1];
		return [ game.name, 'Backglass by <strong>' + backglass.author.user + '</strong>' ];
	}
});

filters.filter('dlMedia', function(DisplayService) {
	return function(data) {
		var game = data[0];
		var media = data[1];
		return [
			game.name,
			DisplayService.media(media.type) + ' (' + media.format + ') by <strong>' + media.author.user + '</strong>'
		];
	}
});

filters.filter('dlPack', function() {
	return function(pack) {
		return [
			pack.manufacturer + ' ' + pack.number,
			pack.name
		];
	}
});


filters.filter('fileext', function() {
	return function(files, exts) {
		return _.filter(files, function(file) {
			var ext = file.name.substr(file.name.lastIndexOf('.') + 1, file.name.length).toLowerCase();
			return _.contains(exts, ext);
		});
	};
});

