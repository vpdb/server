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

"use strict"; /* global angular, ga, _ */

/**
 * Tracker service.
 *
 * See https://developers.google.com/analytics/devguides/collection/analyticsjs/
 */
angular.module('vpdb.tracker', [])

	.factory('TrackerService', function($rootScope, Config, AuthService) {

		return {

			/**
			 * Initializes GA
			 */
			init: function() {
				// enable ga
				if (Config.ga && Config.ga.enabled) {
					if (AuthService.user) {
						ga('create', Config.ga.id, 'auto');
					} else {
						ga('create', Config.ga.id, 'auto', { userId: AuthService.user.id });
					}
					$rootScope.$on('userUpdated', function(event, user) {
						ga('set', 'userId', user.id);
					});
					console.info('Google Analytics initialized.');

				} else {
					console.info('Google Analytics disabled.');
				}
			},

			/**
			 * Tracks a page view.
			 */
			trackPage: function() {
				if (Config.ga && Config.ga.enabled) {
					ga('send', 'pageview');
				}
			}
		};
	});



