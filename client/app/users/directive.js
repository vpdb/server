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
							templateUrl: '/modal/modal-user-info.html',
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
	});