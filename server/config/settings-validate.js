var _ = require('underscore');
var fs = require('fs');

/**
 * Settings validations for VPFB
 *
 * !!! Don't copy this as settings template !!!
 */
module.exports = {

	/**
	 * Application-specific settings.
	 */
	vpdb: {

		/**
		 * Public host name of the server.
		 */
		host: function(host) {
			var validIp = !/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(host);
			var validHost = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/.test(host);
			if (!validIp && !validHost) {
				return 'Must be a valid host or IP address';
			}
		},

		/**
		 * The public port of the server. Note that this isn't what defines on which port
		 * the app listens, for that set the PORT environment variable.
		 */
		port: function(port) {
			if (!parseInt(port) || parseInt(port) > 65535 || parseInt(port) < 1) {
				return 'Port must be an integer between 1 and 65535'
			}
		},

		/**
		 * Database configuration. Must point to a MongoDB schema.
		 */
		db: function(db) {
			if (!/mongodb:\/\/[^\/]+\/[a-z0-9]+/i.test(db)) {
				return 'Database must fit the scheme "mongodb://<host>/<db-name>"';
			}
		},

		/**
		 * True if the host defined above is reachable via https. It is highly encouraged
		 * to enable HTTPS!
		 */
		httpsEnabled: function(httpsEnabled) {
			if (!_.isBoolean(httpsEnabled)) {
				return 'Must be a boolean value';
			}
		},

		/**
		 * Session timeout in milliseconds.
		 */
		sessionTimeout: function(timeout) {
			if (!parseInt(timeout) || parseInt(timeout) < 1) {
				return 'Session timeout must be a number greater than 0'
			}
		},

		/**
		 * Secret for hashing stuff. Create something long here: http://strongpasswordgenerator.com/
		 * @important
		 */
		secret: function(secret) {
			if (secret.length < 10) {
				return 'Your secret must be longer than 10 characters. Please use a generator, e.g. http://strongpasswordgenerator.com/';
			}
			if (secret == 'alongsecret') {
				return 'You\'re using the default secret. Please use a generator, e.g. http://strongpasswordgenerator.com/';
			}
		},

		/**
		 * A temp folder for extracting stuff. No trailing slash!
		 * @important
		 */
		tmp: function(path) {
			if (!fs.existsSync(path)) {
				return 'Temp path does not exist. Please point it to an existing folder or create the mentioned path';
			}

			if (!fs.lstatSync(path).isDirectory()) {
				return 'Temp path is not a folder. Please make it point to a folder';
			}
		},

		/**
		 * Configure login strategies here.
		 */
		passport: {

			/**
			 * GitHub. You'll need to create an application here:
			 *    https://github.com/settings/applications/
			 */
			github: {

				/**
				 * Set false to disable.
				 */
				enabled: function(isEnabled) {
					if (!_.isBoolean(isEnabled)) {
						return 'Enabled flag must be either true or false';
					}
				},

				/**
				 * The client ID of the generated application.
				 */
				clientID: function(id) {
					if (id.length == 0) {
						return 'Your client ID must be longer than 0 characters. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client ID';
					}
					if (id == 'CLIENT_ID') {
						return 'You\'re using the default client ID. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client ID';
					}
				},

				/**
				 * The client secret of the generated application.
				 */
				clientSecret: function(secret) {
					if (secret.length == 0) {
						return 'Your client secret must be longer than 0 characters. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client secret';
					}
					if (secret == 'CLIENT_SECRET') {
						return 'You\'re using the default client secret. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client secret';
					}
				}
			},

			/**
			 * Ipboard
			 * Install https://github.com/freezy/ipb-oauth2-server
			 */
			ipboard: {

				/**
				 * Set false to disable.
				 */
				enabled: function(isEnabled) {
					if (!_.isBoolean(isEnabled)) {
						return 'Enabled flag must be either true or false';
					}
				},

				/**
				 * Must contain only letters from a-z (no spaces or special chars).
				 */
				id: function(id) {
					if (!/^[a-z0-9]+$/.test(id)) {
						return 'ID must be alphanumeric'
					}
				},

				/**
				 * Index file of the forum.
				 */
				baseURL: function(url) {
					var urlErr = checkUrl(url);
					if (urlErr) {
						return urlErr;
					}
					if (url == 'https://localhost/forums/index.php') {
						return 'You\'re using the default base URL';
					}
				},

				/**
				 * The client ID of the generated application.
				 */
				clientID: function(id) {
					if (id.length == 0) {
						return 'Your client ID must be longer than 0 characters';
					}
					if (id == 'CLIENT_ID') {
						return 'You\'re using the default client ID';
					}
				},

				/**
				 * The client secret of the generated application.
				 */
				clientSecret: function(secret) {
					if (secret.length == 0) {
						return 'Your client secret must be longer than 0 characters';
					}
					if (secret == 'CLIENT_SECRET') {
						return 'You\'re using the default client secret';
					}
				},

				__array: true
			}
		}
	}
};

function checkUrl(str) {
	var pattern = new RegExp(
			"^" +
			// protocol identifier
			"(?:(?:https?)://)" +
			// user:pass authentication
			"(?:\\S+(?::\\S*)?@)?" +
			"(?:" +
			// IP address dotted notation octets
			// excludes loopback network 0.0.0.0
			// excludes reserved space >= 224.0.0.0
			// excludes network & broacast addresses
			// (first & last IP address of each class)
			"(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])" +
			"(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}" +
			"(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))" +
			"|localhost|" +
			// host name
			"(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)" +
			// domain name
			"(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*" +
			// TLD identifier
			"(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))" +
			")" +
			// port number
			"(?::\\d{2,5})?" +
			// resource path
			"(?:/[^\\s]*)?" +
			"$", "i"
	);
	if (!pattern.test(str)) {
		return 'Must be a valid URL';
	}
}



