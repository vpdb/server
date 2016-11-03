"use strict"; /* global, angular, _*/

angular.module('vpdb.builds', [])

	.controller('AdminBuildCtrl', function($scope, $rootScope, $uibModal, BuildResource, TrackerService) {

		$scope.theme('light');
		$scope.setTitle('Builds');
		$scope.setMenu('admin');
		TrackerService.trackPage();

		$scope.blocks = [];
		var refresh = function() {
			BuildResource.query(function(builds) {
				var byType = {};
				var ranges = [];
				_.each(_.sortByOrder(builds, ['built_at'], ['desc']), function(build) {
					if (build.is_range) {
						ranges.push(build);
					} else {
						if (!byType[build.type]) {
							byType[build.type] = [];
						}
						byType[build.type].push(build);
					}
				});
				$scope.blocks = ([
					{ title: 'Official Releases', builds: byType.release },
					{ title: 'Experimental Releases', builds: byType.experimental },
					{ title: 'Nightly Releases', builds: byType.nightly },
					{ title: 'Ranges', builds: ranges }
				]);
			});
		};

		$scope.edit = function(build) {
			$uibModal.open({
				templateUrl: '/builds/modal-build-edit.html',
				controller: 'AdminBuildEditCtrl',
				size: 'lg',
				resolve: {
					build: function () {
						return build;
					}
				}
			}).result.then(function(updatedBuild) {
				if (updatedBuild) {
					_.assign(build, updatedBuild);
				} else {
					refresh();
				}
			});
		};

		$scope.add = function() {
			$uibModal.open({
				templateUrl: '/builds/modal-build-add.html',
				controller: 'AdminBuildAddCtrl',
				size: 'lg'

			}).result.then(refresh);
		};

		refresh();
	});

