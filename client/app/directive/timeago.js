"use strict"; /* global directives */

/**
 * @see http://jsfiddle.net/lrlopez/dFeuf/
 */
directives.directive('timeAgo', ['timeAgoService', function(timeago) {
	return {
		replace: true,
		restrict: 'EA',
		scope: {
			"fromTime": "@"
		},
		template: '<span></span>',
		link: {
			post: function(scope, linkElement, attrs) {
				scope.timeago = timeago;
				scope.fromTimeMs = new Date(scope.fromTime).getTime();
				scope.timeago.init();
				scope.$watch("timeago.nowTime-fromTimeMs", function(value) {
					if (scope.timeago.nowTime !== undefined) {
						value = scope.timeago.nowTime - scope.fromTimeMs;
						$(linkElement).text(scope.timeago.inWords(value));
					}
				});
			}
		}
	};
}]);