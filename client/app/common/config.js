"use strict"; /* global vpdbConfig, common, _ */

common

	.constant('Config', vpdbConfig)

	.factory('ConfigService', function(Config) {

		var apiSameHost =
			Config.webUri.protocol === Config.apiUri.protocol &&
			Config.webUri.hostname === Config.apiUri.hostname &&
			Config.webUri.port === Config.apiUri.port;

		return {
			apiUri: function(path) {
				if (apiSameHost) {
					return Config.apiUri.pathname + path;
				} else {
					return this.uri(Config.apiUri);
				}
			},

			uri: function(uri) {
				var port = (uri.protocol === 'http' && uri.port === 80) || (uri.protocol === 'https' && uri.port === 443) ? false : uri.port;
				return uri.protocol + '://' + uri.hostname + (port ? ':' + port : '') + uri.path;
			}
		};
	});