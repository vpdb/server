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

angular.module('vpdb.common', []).controller('RequestGameCtrl', function($scope, $uibModalInstance, ApiHelper, GameRequestResource, ModalService) {

	$scope.gameRequest = {};
	$scope.submitting = false;

	$scope.submit = function() {
		$scope.submitting = true;
		GameRequestResource.save($scope.gameRequest, function(gameRequest) {
			$scope.submitting = false;
			$uibModalInstance.dismiss();

			// show success msg
			ModalService.info({
				icon: 'check-circle',
				title: 'Game Requested!',
				subtitle: gameRequest.ipdb_title,
				message: 'The game has been successfully requested. We\'ll keep you posted!'
			});

		}, ApiHelper.handleErrors($scope, function() {
			$scope.submitting = false;
		}));
	}

});