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
		tmp: '/tmp'
	}

};
