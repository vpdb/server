"use strict"; /* global, angular, _*/

angular.module('vpdb.builds', [])

	.controller('AdminBuildCtrl', function($scope, $uibModal, BuildResource, TrackerService) {

		$scope.theme('light');
		$scope.setTitle('Builds');
		$scope.setMenu('admin');
		TrackerService.trackPage();

		$scope.blocks = [];
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

		$scope.edit = function(build) {
			$uibModal.open({
				templateUrl: '/builds/modal-build-edit.html',
				controller: 'AdminBuildEditCtrl',
				resolve: {
					build: function () {
						return build;
					}
				}
			}).result.then(function(updatedBuild) {
				_.assign(build, updatedBuild);
			});
		};

	});

