"use strict"; /* global ctrl, _ */

ctrl.controller('MethodCollapseCtrl', function($document, $element, $scope, $rootScope, $location, $timeout) {
	
	$scope.isCollapsed = true;

	var updateCollapseState = function() {
		var method, parent, hash = $location.hash();
		if (!hash) {
			return;
		}
		if (!$scope.resource) {
			return;
		}
		if (~hash.indexOf('.')) {
			method = hash.substr(0, hash.indexOf('.'));
			parent = hash.substr(hash.indexOf('.')).replace(/\./g, '/');
		} else {
			method = hash;
			parent = '';
		}
		if ($scope.resource.method === method && $scope.resource.parentUrl === parent) {
			$scope.isCollapsed = false;
			// wait until stuff is extended before scrolling
			$timeout(function() {
				$document.scrollToElement($element, 55, 200);
			}, 250);
		} else {
			$scope.isCollapsed = true;
		}
	}

	$scope.$watch('resource', updateCollapseState);
	$rootScope.$on('$locationChangeSuccess', updateCollapseState);
});
