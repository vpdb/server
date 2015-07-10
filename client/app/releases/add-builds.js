/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

"use strict"; /* global _, angular */

angular.module('vpdb.releases.add', []).controller('AddBuildCtrl', function($scope, $modalInstance, BootstrapTemplate, ApiHelper, BuildResource) {

	$scope.build = {
		platform: 'vp'
	};

	BootstrapTemplate.patchCalendar();

	$scope.types = [ 'release', 'nightly', 'experimental' ];
	$scope.majorVersions = [
		{ label: 'v8.x.x', value: '8' },
		{ label: 'v9.x.x', value: '9' },
		{ label: 'v10.x.x', value: '10' } ];

	$scope.openCalendar = function($event) {
		$event.preventDefault();
		$event.stopPropagation();

		$scope.calendarOpened = true;
	};

	$scope.add = function() {
		BuildResource.save($scope.build, function(build) {
			$modalInstance.close(build);

		}, ApiHelper.handleErrors($scope));
	};
});