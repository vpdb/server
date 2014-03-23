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
		link: {
			post: function(scope, linkElement, attrs) {
				scope.timeago = timeago;
				scope.timeago.init();
				scope.$watch("timeago.nowTime-fromTime", function(value) {
					if (scope.timeago.nowTime != undefined) {
						value = scope.timeago.nowTime - scope.fromTime;
						$(linkElement).text(scope.timeago.inWords(value));
					}
				});
			}
		}
	}
}]);