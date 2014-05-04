/**
 * Global settings file for VPDB.
 *
 * Take special care of @important settings. These are settings where the
 * default value probably doesn't work with your environment. For the others,
 * the default value probably works okay.
 */
module.exports = {

	/**
	 * Application-specific settings.
	 */
	vpdb: {

		/**
		 * Where the HTTP server listens; 80 is the default port.
		 */
		port: 8124,

		/**
		 * Database configuration. Must point to a MongoDB schema.
		 */
		db: 'mongodb://localhost/vpdb',

		/**
		 * Session timeout in milliseconds.
		 */
		sessionTimeout: 3600000,

		/**
		 * Secret for hashing stuff. Create something long here: http://strongpasswordgenerator.com/
		 * @important
		 */
		secret: 'alongsecret',

		/**
		 * A temp folder for extracting stuff. No trailing slash!
		 * @important
		 */
		tmp: '/tmp',

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
				clientID: '',

				/**
				 * The client secret of the generated application.
				 */
				clientSecret: '',

				/**
				 * The callback URL of this application.
				 * @important
				 */
				callbackURL: 'http://localhost:3000/auth/github/callback'
			}
		}
	}

};
