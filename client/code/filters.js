'use strict';

/* Filters */
var filters = angular.module('vpdb.filters', []);

filters.filter('interpolate', function(version) {
	return function(text) {
		return String(text).replace(/\%VERSION\%/mg, version);
	};
});

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