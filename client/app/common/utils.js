"use strict"; /* global angular, _ */

angular.module('vpdb.common', [])

	/**
	 * Converts byte size into something more readable.
	 */
	.filter('bytes', function() {
		return function(bytes, precision) {
			if (isNaN(parseFloat(bytes)) || !isFinite(bytes)) {
				return '-';
			}
			if (typeof precision === 'undefined') {
				precision = 1;
			}
			var units = ['bytes', 'kB', 'MB', 'GB', 'TB', 'PB'],
				number = Math.floor(Math.log(bytes) / Math.log(1024));
			return (bytes / Math.pow(1024, Math.floor(number))).toFixed(precision) +  ' ' + units[number];
		};
	})


	.filter('escape', function() {
		return window.escape;
	})

	.filter('hex', function() {
		return function(data) {
			return data ? data.toString(16) : '';
		};
	})

	.filter('fileext', function() {
		return function(files, exts) {
			return _.filter(files, function(file) {
				var ext = file.name.substr(file.name.lastIndexOf('.') + 1, file.name.length).toLowerCase();
				return _.contains(exts, ext);
			});
		};
	})


	.directive('onEnter', function() {
		return {
			link: function(scope, element, attrs) {
				element.bind("keypress", function (event) {
					if (event.which === 13) {
						scope.$apply(function () {
							scope.$eval(attrs.onEnter);
						});
						event.preventDefault();
					}
				});
			}
		};
	})

	.directive('focusOn', function() {
		return function(scope, elem, attr) {
			elem[0].focus();
		};
	})

	.directive('pageTitle', function($rootScope) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				$rootScope.pageTitle = attrs.pageTitle;
			}
		};
	})

	.directive('fallbackIcon', function () {
		return {
			link: function postLink(scope, element, attrs) {
				element.bind('error', function() {
					angular.element(this).replaceWith('<svg class="svg-icon ' + attrs.class + '"><use xlink:href="#icon-' + attrs.fallbackIcon + '"></use></svg>');
				});
			}
		};
	});


