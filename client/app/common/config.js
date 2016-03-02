"use strict"; /* global vpdbConfig, angular, _ */

angular.module('vpdb.common', [])

	.constant('Config', vpdbConfig)

	.factory('ConfigService', function(Config) {

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

			uri: function(uri) {
				var port = (uri.protocol === 'http' && uri.port === 80) || (uri.protocol === 'https' && uri.port === 443) ? false : uri.port;
				return uri.protocol + '://' + uri.hostname + (port ? ':' + port : '') + uri.pathname;
			},

			/**
			 * Checks if the URL is either from the API or the storage API
			 * @param {string} urlOrPath URL or path to check
			 */
			isAnyApiUrl: function(urlOrPath) {

				let uri;

				// same host
				if (urlOrPath[0] === '/') {

					// api
					uri = Config.apiUri.pathname;
					if (urlOrPath.substr(0, uri.length) === uri) {
						return true;
					}

					// storage
					uri = Config.storageUri.pathname;
					if (urlOrPath.substr(0, uri.length) === uri) {
						return true;
					}

				} else {

					// api
					uri = this.uri(Config.apiUri);
					if (urlOrPath.substr(0, uri.length) === uri) {
						return true;
					}

					// storage
					uri = this.uri(Config.storageUri);
					if (urlOrPath.substr(0, uri.length) === uri) {
						return true;
					}
				}

				return false;
			}
		};
	});