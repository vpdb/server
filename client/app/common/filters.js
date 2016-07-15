"use strict"; /* global angular, _ */

angular.module('vpdb.common', [])

	.filter('authors', function() {
		return function(authors) {
			var ret = '';
			_.each(authors, function(author) {
				if (ret) {
					ret += ', ';
				}
				ret += '<user>' + author.user.name + '</user>';
			});
			return ret;
		};
	});