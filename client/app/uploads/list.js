/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

"use strict"; /* global angular, _*/

angular.module('vpdb.uploads.list', [])

	.controller('AdminUploadsCtrl', function($scope, $uibModal, ReleaseResource, BackglassResource, RomResource) {

		$scope.theme('light');
		$scope.setTitle('Uploads');
		$scope.setMenu('admin');
		$scope.filters = { status: 'pending' };

		$scope.refresh = function() {
			console.log($scope.filters);
			var query = {
				moderation: $scope.filters.status,
				fields: 'moderation',
				sort: 'modified_at'
			};
			$scope.releases = ReleaseResource.query(query, function() {
				_.each($scope.releases, function(release) {

					var m = release.moderation;
					if (m.is_approved && m.auto_approved) {
						release.icon = 'thumb-up-auto';

					} else if (m.is_approved) {
						release.icon = 'thumb-up';

					} else if (m.is_refused) {
						release.icon = 'thumb-down';

					} else {
						release.icon = 'thumbs-up-down';
					}
					//release.icon = ['thumb-down', 'thumbs-up-down', 'thumb-up', 'thumb-up-auto'][Math.floor(Math.random() * 4)];
				});
			});
		};

		$scope.moderateRelease = function(release) {
			$uibModal.open({
				templateUrl: 'modal/moderate-release.html',
				controller: 'ModerateReleaseCtrl',
				size: 'md',
				resolve: {
					params: function() {
						return {
							release: release
						};
					}
				}
			});
		};

		$scope.refresh();
	})

	.controller('ModerateReleaseCtrl', function($scope, $rootScope, $uibModalInstance, ApiHelper,
												ReleaseResource, ReleaseModerationResource, params) {
		$scope.release = ReleaseResource.get({ release: params.release.id });

		$scope.refuse = function() {
			ReleaseModerationResource.save({ releaseId: $scope.release.id }, { action: 'refuse', message: $scope.message }, function() {
				$uibModalInstance.close();
				$rootScope.showNotification('Release "' + $scope.release.name + '" successfully refused.');
			}, ApiHelper.handleErrors($scope));
		};

		$scope.approve = function() {
			ReleaseModerationResource.save({ releaseId: $scope.release.id }, { action: 'approve', message: $scope.message }, function() {
				$uibModalInstance.close();
				$rootScope.showNotification('Release "' + $scope.release.name + '" successfully approved.');
			}, ApiHelper.handleErrors($scope));
		};

		$scope.moderate = function() {
			ReleaseModerationResource.save({ releaseId: $scope.release.id }, { action: 'moderate', message: $scope.message }, function() {
				$uibModalInstance.close();
				$rootScope.showNotification('Release "' + $scope.release.name + '" successfully set back to pending.');
			}, ApiHelper.handleErrors($scope));
		};
	})

	.filter('statusIcon', function() {
		return function(release) {
			if (release.moderation) {
				return 'check-circle';
			} else {
				return '';
			}
		};
	});

