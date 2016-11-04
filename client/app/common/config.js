"use strict"; /* global vpdbConfig, angular, _ */

angular.module('vpdb.common', [])

	.constant('Config', vpdbConfig)

	.factory('ConfigService', function(Config) {

		// bump these on changes
		vpdbConfig.documentRevisions = {
			rules: 2,
			privacy: 1,
			legal: 1
		};

		var apiSameHost =
			Config.webUri.protocol === Config.apiUri.protocol &&
			Config.webUri.hostname === Config.apiUri.hostname &&
			Config.webUri.port === Config.apiUri.port;

		var storageSameHost =
			Config.webUri.protocol === Config.storageUri.protocol &&
			Config.webUri.hostname === Config.storageUri.hostname &&
			Config.webUri.port === Config.storageUri.port;

		return {
			apiUri: function(path) {
				if (apiSameHost) {
					return Config.apiUri.pathname + (path || '');
				} else {
					return this.uri(Config.apiUri) + (path || '');
				}
			},

			storageUri: function(path, fullPath) {
				if (storageSameHost && !fullPath) {
					return Config.storageUri.pathname + (path || '');
				} else {
					return this.uri(Config.storageUri) + (path || '');
				}
			},

			webUri: function(path) {
				return this.uri(Config.webUri) + (path || '');
			},

			uri: function(uri) {
				var port = (uri.protocol === 'http' && uri.port === 80) || (uri.protocol === 'https' && uri.port === 443) ? false : uri.port;
				return uri.protocol + '://' + uri.hostname + (port ? ':' + port : '') + (uri.pathname || '');
			},

			isApiUrl: function(urlOrPath) {
				var uri;
				if (urlOrPath[0] === '/') {
					uri = Config.apiUri.pathname;
					if (urlOrPath.substr(0, uri.length) === uri) {
						return true;
					}
				} else {
					uri = this.uri(Config.apiUri);
					if (urlOrPath.substr(0, uri.length) === uri) {
						return true;
					}
				}
				return false;
			},

			isStorageUrl: function(urlOrPath) {
				var uri;
				if (urlOrPath[0] === '/') {
					uri = Config.storageUri.pathname;
					if (urlOrPath.substr(0, uri.length) === uri) {
						return true;
					}

				} else {
					uri = this.uri(Config.storageUri);
					if (urlOrPath.substr(0, uri.length) === uri) {
						return true;
					}
				}
				return false;
			},

			/**
			 * Checks if the URL is either from the API or the storage API
			 * @param {string} urlOrPath URL or path to check
			 */
			isAnyApiUrl: function(urlOrPath) {

				return this.isApiUrl(urlOrPath) || this.isStorageUrl(urlOrPath);
			},

			isAuthUrl: function(urlOrPath) {
				if (urlOrPath[0] === '/') {
					return urlOrPath === Config.apiUri.pathname + '/authenticate';
				} else {
					return urlOrPath === this.uri(Config.apiUri) + '/authenticate';
				}
			}
		};
	});