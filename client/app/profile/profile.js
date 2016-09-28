"use strict"; /* global _*/

angular.module('vpdb.profile.settings', [])

	.controller('ProfileCtrl', function($scope, $uibModal) {

		$scope.changeAvatar = function() {
			$uibModal.open({
				templateUrl: 'modal/change-avatar.html',
			});
		}
	});