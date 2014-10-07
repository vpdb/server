"use strict"; /* global vpdbConfig, common, _ */

common

	.constant('Config', vpdbConfig)

	.factory('ConfigService', function(Config) {

		var apiSameHost =
			Config.webUri.scheme === Config.apiUri.scheme &&
			Config.webUri.host === Config.apiUri.host &&
			Config.webUri.port === Config.apiUri.port;

		return {
			apiUri: function(path) {
				if (apiSameHost) {
					return Config.apiUri.path + path;
				} else {
					return this.uri(Config.apiUri);
				}
			},

			uri: function(uri) {
				var port = (uri.scheme === 'http' && uri.port === 80) || (uri.scheme === 'https' && uri.port === 443) ? false : uri.port;
				return uri.scheme + '://' + uri.host + (port ? ':' + port : '') + uri.path;
			}
		};
	});