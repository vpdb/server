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
		 * Where the HTTP server listens; 80 is the default port.
		 */
		port: function(port) {
			if (!parseInt(port) || parseInt(port) > 65535 || parseInt(port) < 1) {
				return 'Port must be an integer between 1 and 65535.'
			}
		},

		/**
		 * Session timeout in milliseconds.
		 */
		sessionTimeout: function(timeout) {
			if (!parseInt(timeout) || parseInt(timeout) < 1) {
				return 'Session timeout must be a number greater than 0.'
			}
		},

		/**
		 * Secret for hashing stuff. Create something long here: http://strongpasswordgenerator.com/
		 * @important
		 */
		secret: function(secret) {
			if (secret.length < 10) {
				return 'Your secret must be longer than 10 characters. Please use a generator, e.g. http://strongpasswordgenerator.com/.';
			}
			if (secret == 'alongsecret') {
				return 'You\'re using the default secret. Please use a generator, e.g. http://strongpasswordgenerator.com/.';
			}
		},

		/**
		 * A temp folder for extracting stuff. No trailing slash!
		 * @important
		 */
		tmp: function(path) {
			if (!fs.existsSync(path)) {
				return 'Temp path "' + path + '" does not exist. Please point it to an existing folder or create the mentioned path.';
			}

			if (!fs.lstatSync(path).isDirectory()) {
				return 'Temp path "' + path + '" is not a folder. Please make it point to a folder.';
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
				 * The client ID of the generated application.
				 */
				clientID: function(id) {
					if (id.length == 0) {
						return 'Your client ID must be longer than 0 characters. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client ID.';
					}
					if (id == 'CLIENT_ID') {
						return 'You\'re using the default client ID. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client ID.';
					}
				},

				/**
				 * The client secret of the generated application.
				 */
				clientSecret: function(secret) {
					if (secret.length == 0) {
						return 'Your client secret must be longer than 0 characters. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client secret.';
					}
					if (secret == 'CLIENT_SECRET') {
						return 'You\'re using the default client secret. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client secret.';
					}
				},

				/**
				 * The callback URL of this application.
				 * @important
				 */
				callbackURL: 'http://localhost:3000/auth/github/callback'
			}
		}
	}
};




