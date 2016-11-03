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

"use strict"; /* global angular _*/

angular.module('vpdb.builds', [])

	.controller('AdminBuildAddCtrl', function($scope, $rootScope, $uibModal, $uibModalInstance, ApiHelper,
											   BootstrapTemplate, BuildResource) {

		BootstrapTemplate.patchCalendar();

		$scope.build = {};
		$scope.platforms = [ { id: 'vp', label: 'Visual Pinball' } ];
		$scope.types = [
			{ id: 'release', label: 'Official Release' },
			{ id: 'experimental', label: 'Experimental Build' },
			{ id: 'nightly', label: 'Nightly Build' }
		];

		$scope.submit = function() {
			var data = _.pick($scope.build, ["id", "platform", "major_version", "label", "download_url", "support_url", "built_at", "description", "type", "is_range", "is_active"]);
			BuildResource.save(data, function(build) {
				BuildResource.update({ id: build.id }, { is_active: true }, function() {
					$uibModalInstance.close();
					$rootScope.showNotification('Successfully added build.');

				}, ApiHelper.handleErrors($scope));
			}, ApiHelper.handleErrors($scope));
		};

		$scope.openCalendar = function($event) {
			$event.preventDefault();
			$event.stopPropagation();
			$scope.calendarOpened = true;
		};

	});

