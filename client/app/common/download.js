"use strict"; /* global vpdbConfig, angular, angular, _ */

angular.module('vpdb.common', [])

	.factory('DownloadService', function($rootScope, $timeout, AuthService, ConfigService) {

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
							headMessage: 'In order to download this file, you need to be logged in. You can register for free just below.',
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