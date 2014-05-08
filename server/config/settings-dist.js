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
		 * Public host name of the server.
		 */
		host: 'localhost',

		/**
		 * The public port of the server. Note that this isn't what defines on which port
		 * the app listens, for that set the PORT environment variable.
		 */
		port: 80,

		/**
		 * Database configuration. Must point to a MongoDB schema.
		 */
		db: 'mongodb://localhost/vpdb',

		/**
		 * True if the host defined above is reachable via https. It is highly encouraged
		 * to enable HTTPS!
		 */
		httpsEnabled: true,

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
				 * Set false to disable.
				 */
				enabled: true,

				/**
				 * The client ID of the generated application.
				 * @important
				 */
				clientID: 'CLIENT_ID',

				/**
				 * The client secret of the generated application.
				 * @important
				 */
				clientSecret: 'CLIENT_SECRET'
			},

			/**
			 * IP.Board OAuth2 authentication.
			 * You'll need to install the ipb-oauth2-server application here:
			 * 		https://github.com/freezy/ipb-oauth2-server
			 *
			 * You can also add multiple entries if you like to offer authentication from multiple boards.
			 */
			ipboard: [{

				/**
				 * Set false to disable.
				 */
				enabled: false,

				/**
				 * Must contain only letters or numbers (no spaces or special chars).
				 */
				id: 'myipboard',

				/**
				 * Label of the button
				 */
				name: 'My IP Board',

				/**
				 * Icon class for the button, separated by space. Set empty or null if no icon.
				 */
				icon: '',

				/**
				 * Index file of the forum.
				 */
				baseURL: 'https://localhost/forums/index.php',

				/**
				 * The client ID of the generated application.
				 * @important
				 */
				clientID: 'CLIENT_ID',

				/**
				 * The client secret of the generated application.
				 * @important
				 */
				clientSecret: 'CLIENT_SECRET'

			}]
		}
	}

};
