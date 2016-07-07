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

"use strict"; /* global _*/

angular.module('vpdb.uploads.list', [])

	.controller('AdminUploadsCtrl', function($scope, $uibModal, ReleaseResource, BackglassResource, RomResource) {

		$scope.theme('light');
		$scope.setTitle('Uploads');
		$scope.setMenu('admin');
		$scope.statusFilter = 'all';

		var icons = ['thumb-down', 'thumbs-up-down', 'thumb-up', 'thumb-up-auto'];

		$scope.refresh = function() {
			$scope.releases = ReleaseResource.query({ moderation: $scope.statusFilter, fields: 'moderation' }, function() {
				_.each($scope.releases, function(release) {
					if (release.moderation.is_approved) {
						release.icon = 'check-circle';
					} else {
						release.icon = 'radio-unchecked';
					}
					release.icon = icons[Math.floor(Math.random() * 4)];
				});
			});
		};

		$scope.refresh();
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

