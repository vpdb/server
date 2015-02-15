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

"use strict"; /* global vpdbConfig, common, angular, _ */

common.factory('DownloadService', function($rootScope, $timeout, AuthService, ConfigService) {

		return {
			downloadFile: function(file, callback) {
				var submit = function() {
					$timeout(function() {
						angular.element('#downloadForm').submit();
						if (callback) {
							callback();
						}
					}, 0);
				};

				if (file.is_protected) {
					if (AuthService.isAuthenticated) {
						AuthService.fetchUrlTokens(file.url, function(err, tokens) {
							// todo treat error
							$rootScope.downloadLink = file.url;
							$rootScope.downloadBody = '';
							$rootScope.downloadToken = tokens[file.url];
							submit();
						});

					} else {
						$rootScope.login({
							headMessage: 'In order to download this file, you need to be logged. You can register for free just below.',
							postLogin: { action: 'downloadFile', params: file }
						});
					}

				} else {
					$rootScope.downloadLink = file.url;
					$rootScope.downloadBody = '';
					$rootScope.downloadToken = '';
					submit();
				}
			},

			downloadRelease: function(releaseId, downloadRequest, callback) {

				var path = '/releases/' + releaseId;
				var url = ConfigService.storageUri(path);
				AuthService.fetchUrlTokens(url, function(err, tokens) {
					// todo treat error
					$rootScope.downloadLink = ConfigService.storageUri(path, true);
					$rootScope.downloadBody = JSON.stringify(downloadRequest);
					$rootScope.downloadToken = tokens[url];
					$timeout(function() {
						angular.element('#downloadForm').submit();
						if (callback) {
							callback();
						}
					}, 0);
				});

			}
		};
	});