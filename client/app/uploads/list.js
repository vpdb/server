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


	.controller('AdminUploadsCtrl', function($scope) {

		$scope.theme('light');
		$scope.setTitle('Uploads');
		$scope.setMenu('admin');
		$scope.filters = { status: 'pending' };
		$scope.numItems = 5;

		$scope.Math = window.Math;

		$scope.refresh = function() {
			$scope.$broadcast('refresh');
		};
		$scope.refresh();
	})

	.controller('AdminReleaseUploadsCtrl', function($scope, $uibModal, ApiHelper, ReleaseResource) {

		var refresh = function(query) {
			query = query || {
				moderation: $scope.filters.status,
				fields: 'moderation',
				sort: 'modified_at',

				per_page: $scope.numItems
			};
			$scope.releases = ReleaseResource.query(query, ApiHelper.handlePagination($scope, { loader: true }, function() {
				_.each($scope.releases, addIcons);
			}));
		};

		$scope.paginate = function(link) {
			refresh(link.query);
		};

		$scope.$on('refresh', function() {
			refresh();
		});

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
	})
	.controller('ModerateReleaseCtrl', function($scope, $rootScope, $uibModalInstance, ApiHelper,
												ReleaseResource, ReleaseModerationResource, FileBlockmatchResource,
												ModalService, params) {

		$scope.files = [];
		$scope.release = ReleaseResource.get({ release: params.release.id, fields: 'moderation' }, function(release) {
			$scope.history = _.map(release.moderation.history, function(item) {
				var h = {
					message: item.message,
					created_at: new Date(item.created_at),
					created_by: item.created_by
				};
				switch (item.event) {
					case 'approved':
						h.status = 'Approved';
						h.icon = 'thumb-up';
						break;
					case 'refused':
						h.status = 'Refused';
						h.icon = 'thumb-down';
						break;
					case 'pending':
						h.status = 'Set to Pending';
						h.icon = 'thumbs-up-down';
						break;
				}
				return h;
			});
			_.each(release.versions, function(version) {
				_.each(version.files, function(file) {
					file.blockmatches = FileBlockmatchResource.get({ id: file.file.id }, function(b) {
						if (b.matches.length > 0) {
							$scope.files.push(file);
						}
					});
				});
			});
		});

		$scope.blockmatchInfo = function() {
			ModalService.info({
				title: 'Similar releases',
				message: 'Visual Pinball table files are made out of blocks. Every, image, sound or object is a block. ' +
				'When a table file is uploaded, VPDB saves the checksum and size of every block to a heavily indexed ' +
				'table in the database.<br>' +
				'What you see listed under "Similar releases" are table files of other releases that have lots ' +
				'of blocks with the same checksum. <ul>' +
				'<li>The "Objects" bar indicates how many blocks are in common. For example, if a table file with ' +
				'3,000 blocks has a 75% object match, that means 2,250 blocks are identical.</li>' +
				'<li>The "Bytes" bar indicates how much of the actual data the table file has in common. For example, ' +
				'a 60 MB file with 50% bytes match means that 30 MB are identical with the table file you\'re ' +
				'reviewing.</li></ul>' +
				'Generally, two observerations can be made: High bytes match and low object match means that the table ' +
				'has been heavily tweaked, while size-heavy assets such as textures and 3D models have been kept the ' +
				'same.<br>On the other hand, a high object match and low bytes match indicates that mainly assets have ' +
				'been replaced while leaving the rest intact.<br><br>' +
				'As a moderator, you should make sure that in case of a match, the uploader has properly credited the ' +
				'original work, either as co-authors or in the acknowledgements.'
			});
		};

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

	.controller('AdminBackglassUploadsCtrl', function($scope, $uibModal, ApiHelper, BackglassResource) {

		var refresh = function(query) {
			query = query || {
					moderation: $scope.filters.status,
					fields: 'moderation',
					sort: 'modified_at',

					per_page: $scope.numItems
				};
			$scope.backglasses = BackglassResource.query(query, ApiHelper.handlePagination($scope, { loader: true }, function() {
				_.each($scope.backglasses, addIcons);
			}));
		};

		$scope.paginate = function(link) {
			refresh(link.query);
		};

		$scope.$on('refresh', function() {
			refresh();
		});
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

function addIcons(entity) {
	var m = entity.moderation;
	if (m.is_approved && m.auto_approved) {
		entity.icon = 'thumb-up-auto';

	} else if (m.is_approved) {
		entity.icon = 'thumb-up';

	} else if (m.is_refused) {
		entity.icon = 'thumb-down';

	} else {
		entity.icon = 'thumbs-up-down';
	}
}