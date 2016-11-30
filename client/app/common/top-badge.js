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

"use strict";
/* global angular, _ */

angular.module('vpdb.common', [])

	.directive('topBadge', function() {

		return {
			restrict: 'E',
			scope: {
				ranks: '=ngModel',
				site: '@',
				href: '@'
			},
			replace: true,
			templateUrl: '/common/top-badge.html',
			controller: function($scope) {

				$scope.$watch('ranks', function(ranks) {
					if (ranks && ranks.length > 0) {
						$scope.hasRank = $scope.ranks;
						$scope.rank = _.min(ranks);
						if ($scope.rank <= 10) {
							$scope.top = 10;
							$scope.place = 'gold';
						} else if ($scope.rank <= 100) {
							$scope.top = 100;
							$scope.place = 'silver';
						} else {
							$scope.top = 300;
							$scope.place = 'bronze';
						}
					}
				});
			}
		};
	});