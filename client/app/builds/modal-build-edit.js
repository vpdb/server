"use strict"; /* global, angular, _*/

angular.module('vpdb.builds', [])

	.controller('AdminBuildEditCtrl', function($scope, $uibModal, $uibModalInstance, BuildResource, build) {

		$scope.build = build;
		$scope.platforms = [ { id: 'vp', label: 'Visual Pinball' } ];
		$scope.types = [
			{ id: 'release', label: 'Official Release' },
			{ id: 'experimental', label: 'Experimental Build' },
			{ id: 'nightly', label: 'Nightly Build' }
		];
		$scope.build = BuildResource.get({ id: build.id });

		$scope.openCalendar = function($event) {
			$event.preventDefault();
			$event.stopPropagation();
			$scope.calendarOpened = true;
		};

	});

