"use strict"; /* global angular _*/

angular.module('vpdb.builds', [])

	.controller('AdminBuildEditCtrl', function($scope, $rootScope, $uibModal, $uibModalInstance, ApiHelper,
											   BootstrapTemplate, BuildResource, ReleaseResource, build) {

		BootstrapTemplate.patchCalendar();

		$scope.id = build.id;
		$scope.build = build;
		$scope.platforms = [ { id: 'vp', label: 'Visual Pinball' } ];
		$scope.types = [
			{ id: 'release', label: 'Official Release' },
			{ id: 'experimental', label: 'Experimental Build' },
			{ id: 'nightly', label: 'Nightly Build' }
		];
		BuildResource.get({ id: build.id }, function(b) {
			build = b;
			$scope.build = _.cloneDeep(build);
			$scope.releases = ReleaseResource.query({
				moderation: 'all',
				builds: build.id,
				thumb_format: 'square'
			}, ApiHelper.handlePagination($scope));
		});

		$scope.save = function() {
			var data = _.pick($scope.build, ["id", "platform", "major_version", "label", "download_url", "support_url", "built_at", "description", "type", "is_range", "is_active"]);
			BuildResource.update({ id: $scope.id }, data, function(updatedBuild) {
				$uibModalInstance.close(updatedBuild);
				$rootScope.showNotification('Successfully updated build.');

			}, ApiHelper.handleErrors($scope));
		};

		$scope.delete = function(build) {
			BuildResource.delete({ id: build.id }, function() {
				$rootScope.showNotification('Successfully deleted build.');
				$uibModalInstance.close();

			}, ApiHelper.handleErrorsInDialog($scope, 'Error deleting build'));
		};

		$scope.openCalendar = function($event) {
			$event.preventDefault();
			$event.stopPropagation();
			$scope.calendarOpened = true;
		};

		$scope.reset = function() {
			$scope.build = _.cloneDeep(build);
		};

	});

