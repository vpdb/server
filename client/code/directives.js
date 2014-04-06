'use strict';

/* Directives */

var directives = angular.module('vpdb.directives', []);

directives.directive('appVersion', function(version) {
	return function(scope, elm, attrs) {
		elm.text(version);
	};
});

directives.directive('ratingbox', function($parse) {
	return {
		restrict: 'C',
		scope: true,
		controller: function($scope, $element, $attrs) {

			$scope.$watch($parse($attrs.ratingAvg), function(val) {
				$scope.ratingAvg = Math.round(val);
			});
			if ($attrs.ratingVotes) {
				var votes = $parse($attrs.ratingVotes);
				$scope.$watch('ratingUser', function(newVal, oldVal) {
					if (!oldVal) {
						votes.assign($scope, votes($scope) + 1);
					}
				});
			}

			$scope.states = [
				{ stateOn: 'fa fa-star star-left star-on', stateOff: 'fa fa-star star-left star-off' },
				{ stateOn: 'fa fa-star star-right star-on', stateOff: 'fa fa-star star-right star-off' },
				{ stateOn: 'fa fa-star star-left star-on', stateOff: 'fa fa-star star-left star-off' },
				{ stateOn: 'fa fa-star star-right star-on', stateOff: 'fa fa-star star-right star-off' },
				{ stateOn: 'fa fa-star star-left star-on', stateOff: 'fa fa-star star-left star-off' },
				{ stateOn: 'fa fa-star star-right star-on', stateOff: 'fa fa-star star-right star-off' },
				{ stateOn: 'fa fa-star star-left star-on', stateOff: 'fa fa-star star-left star-off' },
				{ stateOn: 'fa fa-star star-right star-on', stateOff: 'fa fa-star star-right star-off' },
				{ stateOn: 'fa fa-star star-left star-on', stateOff: 'fa fa-star star-left star-off' },
				{ stateOn: 'fa fa-star star-right star-on', stateOff: 'fa fa-star star-right star-off' }
			];
		}
	}
});

directives.directive('flipbox', function($timeout) {
	return {
		restrict: 'C',
		scope: true,
		controller: function($scope, $element) {

			$scope.active = false;

			$element.click(function() {
				if ($scope.active) {
					return;
				}
				$scope.active = true;
				$element.addClass('active');
				$scope.$apply();

				$timeout(function() {
					$scope.active = false;
					$element.removeClass('active');
					$element.toggleClass('reverse');
				}, 650, true);
			});
		}
	}
});

directives.directive('stars', function() {
	return {
		replace: true,
		restrict: 'C',
		scope: true,
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
});

directives.directive('markdown', function($sanitize) {
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

directives.directive('fadeAfterLoad', function() {
	return {
		restrict: 'C',
		link: function(scope, element, attrs) {
			element.waitForImages({
				each: function() {
					var that = $(this);
					that.addClass('loaded');
				},
				waitForAll: true
			});
		}
	};
});
