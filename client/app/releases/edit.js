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

"use strict"; /* global _, angular */

/**
 * Main controller containing the form for editing a release.
 */
angular.module('vpdb.releases.edit', []).controller('ReleaseFileEditCtrl', function($scope, $stateParams, GameResource,
																					ReleaseResource, TagResource) {

	// init page
	$scope.theme('light');
	$scope.setMenu('releases');
	$scope.setTitle('Edit Release');

	// fetch objects
	$scope.game = GameResource.get({ id: $stateParams.id });
	$scope.release = ReleaseResource.get({ release: $stateParams.releaseId });
	$scope.tags = TagResource.query();

});