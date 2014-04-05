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

filters.filter('mediatype', function() {
	return function(type) {
		switch (type) {
			case 'backglass':
				return 'Backglass';
			case 'flyer':
				return 'Flyer';
			case 'instructioncard':
				return 'Instruction Card';
			default:
				return 'Unknown';
		}
	}
});