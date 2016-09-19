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

"use strict"; /* global app, angular, _ */

angular.module('vpdb.common', [])

	.directive('user', function($compile, $uibModal, $rootScope, AuthService) {
		return {
			restrict: 'E',
			link: function(scope, element) {
				$rootScope.$on('user', function() {
					if (AuthService.hasPermission('users/view')) {
						element.addClass('a');
					} else {
						element.removeClass('a');
					}
				});
				if (AuthService.hasPermission('users/view')) {
					element.addClass('a');
				}
				element.click(function() {
					if (AuthService.hasPermission('users/view')) {
						$uibModal.open({
							templateUrl: '/users/modal-user-info.html',
							controller: 'UserDetailCtrl',
							resolve: {
								username: function() {
									return element.html();
								}
							}
						});
					}
				});
			}
		};
	})

	.controller('UserDetailCtrl', function($scope, $http, UserResource, UserStarResource, ModalService, username) {
		UserResource.query({ name: username }, function(users) {
			$scope.user = users.length ? users[0] : {};
			if ($scope.user.id) {
				UserStarResource.get({ userId: $scope.user.id }).$promise.then(function() {
					$scope.starred = true;
				}, function() {
					$scope.starred = false;
				});
			}
		});

		$scope.toggleStar = function() {
			var err = function(err) {
				if (err.data && err.data.error) {
					ModalService.error({
						subtitle: 'Error starring user.',
						message: err.data.error
					});
				} else {
					console.error(err);
				}
			};
			if ($scope.starred) {
				UserStarResource.delete({ userId: $scope.user.id }, {}, function() {
					$scope.starred = false;
					$scope.user.counter.stars--;
				}, err);

			} else {
				UserStarResource.save({ userId: $scope.user.id }, {}, function(result) {
					$scope.starred = true;
					$scope.user.counter.stars = result.total_stars;
				}, err);
			}
		}
	});