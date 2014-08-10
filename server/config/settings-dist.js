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
		 *
		 * This is used to construct URLs. The actual server always listens on
		 * `localhost`.
		 */
		host: 'localhost',

		/**
		 * The public port of the server.
		 *
		 * Note that this is NOT what defines on which port the app listens,
		 * for that set the `PORT` environment variable. However, when running
		 * the server via Grunt, it will read this variable and set the env
		 * accordingly IF unset.
		 */
		port: 80,

		/**
		 * True if the host defined above is reachable via https. It is highly encouraged
		 * to enable HTTPS!
		 */
		httpsEnabled: true,

		/**
		 * Database configuration. Must point to a MongoDB schema.
		 */
		db: 'mongodb://localhost/vpdb',

		/**
		 * Redis configuration.
		 */
		redis: {
			host: '127.0.0.1',
			port: 6379
		},

		/**
		 * Session timeout in milliseconds (technically it's the expiration length of the JWT)
		 */
		sessionTimeout: 3600000,

		/**
		 * Secret for hashing and signing. Create something long here: http://strongpasswordgenerator.com/
		 * @important
		 */
		secret: 'alongsecret',

		/**
		 * Where the files are stored.
		 * @important
		 */
		storage: './data/storage',

		/**
		 * Quota definitions for the site. Quotas can be used to limit the
		 * number of items a user can download in a given time.
		 */
		quota: {
			/**
			 *  Every user has one plan assigned. The plan defines how many
			 *  credits the user is allowed to burn for a given duration.
			 *  After the duration, the credits are reset.
			 *
			 *  Valid durations are: "minute", "hour", "day" and "week". If
			 *  "unlimited" is set to true, the quota check is skipped.
			 *
			 *  You can add any number of plans here (they will show up in the
			 *  user control panel), but at least one default plan must exist.
			 */
			plans: {
				free: { credits: 5, per: 'day' },
				bronze: { credits: 50, per: 'day' },
				silver: { credits: 200, per: 'day' },
				gold: { credits: 5000, per: 'day' },
				unlimited: { unlimited: true }
			},

			/**
			 * The default plan which is assigned to new users.
			 */
			defaultPlan: 'free',

			/**
			 * How many credits are debited per download. For now, you can
			 * define different costs per MIME type of the file, other
			 * attributes are imaginable in the future.
			 *
			 * Note that if a MIME type is not defined here (list can be
			 * checked here[1]), no cost will be applied to it.
			 *
			 * [1] https://github.com/freezy/node-vpdb/blob/master/server/models/file.js#L9
			 *
			 * Also note that packs value the sum of their content and even
			 * though they are zipped, they won't count as zip files.
			 */
			costs: {
				'image/jpeg': 0,
				'image/png': 0,
				'text/plain': 0,
				'application/zip': 1,
				'application/x-visual-pinball-table': 1,
				'video/mp4': 1,
				'video/x-flv': 1
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
		},

		/**
		 * A temp folder for extracting stuff. No trailing slash!
		 * @important
		 */
		tmp: '/tmp',

		/**
		 * HTTP header where the JWT is send from the client. If you globally
		 * protect the site with let's say HTTP Basic, you'd need to use
		 * different name for the authorization header.
		 */
		authorizationHeader: 'Authorization'
	}

};
