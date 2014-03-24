'use strict';

/* Directives */

var directives = angular.module('vpdb.directives', []).
	directive('appVersion', function(version) {
		return function(scope, elm, attrs) {
			elm.text(version);
		};
	}).
	directive('stars', function(version) {
		return {
			replace: true,
			restrict: 'C',
			scope: false,
			link: {
				post: function(scope, element, attrs) {
					var star0 = '<i class="fa fa-star-o"></i>';
					var star1 = '<i class="fa fa-star-half-o"></i>';
					var star2 = '<i class="fa fa-star"></i>';
					var stars = '';
					var rating = attrs.value / 2;
					for (var i = 0; i < 5; i++) {
						if (rating < 0.25) {
							stars += star0;
						} else if (rating < 0.75) {
							stars += star1;
						} else {
							stars += star2;
						}
						rating -= 1.0;
					}
					element.html(stars);
				}
			}
		};
	}).
	directive('markdown', function($sanitize) {
		var converter = new Showdown.converter();
		return {
			restrict: 'AE',
			link: function(scope, element, attrs) {
				if (attrs.markdown) {
					scope.$watch(attrs.markdown, function(newVal) {
						var html = newVal ? $sanitize(converter.makeHtml(newVal)) : '';
						element.html(html);
					});
				} else {
					var html = $sanitize(converter.makeHtml(element.text()));
					element.html(html);
				}
			}
		};
	});
