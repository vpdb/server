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
		 * Name of the application
		 *
		 * @important
		 */
		name: 'VPDB API',

		/**
		 * Public URI of the API.
		 *
		 * This is used to construct URLs. The actual server always listens on
		 * `localhost`.
		 *
		 * Note that for now, the API and the storage API are the same
		 * application. However, that might change in the future so we might
		 * as well set it up flexible enough in the first place.
		 *
		 * @important
		 */
		api: { protocol: 'https', hostname: 'localhost', port: 3000, pathname: '/api/v1', prefix: '' },

		/**
		 * Storage-related URLs and paths.
		 *
		 * We have two storage end-points: A public one that is served by the
		 * reverse proxy directly for files that don't need authentication,
		 * and a protected one for API commands and protected downloads.
		 *
		 * @important
		 */
		storage: {

			/**
			 * Public files (no authentication needed).
 			 */
			'public': {

				/** Path on the file system */
				path: './data/storage-public',

				/** URI of the API. Used to construct URLs. */
				api: { protocol: 'https', hostname: 'localhost', port: 3000, pathname: '/public', prefix: '' }
			},

			/**
			 * Protected files (need authentication, even if download might be free).
			 */
			'protected': {

				/** Path on the file system */
				path: './data/storage-protected',

				/** URI of the API. Used to construct URLs. */
				api: { protocol: 'https', hostname: 'localhost', port: 3000, pathname: '/storage/v1', prefix: '' }
			}
		},

		/**
		 * Public URI of the web application.
		 *
		 * This is used to construct URLs. The actual server always listens on
		 * `localhost`.
		 *
		 * @important
		 */
		webapp: { protocol: 'https', hostname: 'localhost', port: 3000 },

		/**
		 * Lifetime of the API JWT in milliseconds.
		 */
		apiTokenLifetime: 3600000,

		/**
		 * Lifetime of the ticket token in the URL for images and videos, in milliseconds.
		 */
		storageTokenLifetime: 60000,

		/**
		 * Database configuration. Must point to a MongoDB schema.
		 */
		db: 'mongodb://localhost/vpdb',

		/**
		 * Redis configuration.
		 */
		redis: {
			host: '127.0.0.1',
			port: 6379,
			db: 0
		},

		/**
		 * Secret for hashing and signing. Create something long here: http://strongpasswordgenerator.com/
		 * @important
		 */
		secret: 'alongsecret',

		/**
		 * Various mail settings.
		 */
		email: {

			/**
			 * If true, user email address is validated on registration and
			 * change. Otherwise, email addresses are only syntactically
			 * validated.
			 */
			confirmUserEmail: true,

			/**
			 * Sender of the automated mails
			 */
			sender: {
				email: 'server@vpdb.local',
				name: 'VPDB Server'
			},

			/**
			 * Options passed to Nodemailer
			 *
			 * @see https://github.com/andris9/nodemailer-smtp-transport
			 * @important
			 */
			nodemailer: {
				host: 'localhost',
				port: 25,
				auth: {
					user: 'username',
					pass: 'password'
				}
			}
		},

		/**
		 * Sets various logging options.
		 */
		logging: {

			/**
			 * Log level. Allowed values: [ 'silly', 'debug', 'verbose', 'info', 'warn', 'error' ]
			 */
			level: 'info',

			/**
			 * Prints log to the current console. Should not be used in production.
			 */
			console: {
				/**
				 * Whether to log HTTP file access
				 */
				access: true,
				/**
				 * Whether to log application data
				 */
				app: true
			},

			/**
			 * Writes log to a file. Rotation etc should be done externally.
			 */
			file: {
				/**
				 * File location of the HTTP access log. Null or empty for no logging.
				 */
				access: '/var/www/staging/shared/logs/access.log',
				/**
				 * File location of the application log. Null or empty for no logging.
				 */
				app: '/var/www/staging/shared/logs/app.log'
			},

			/**
			 * Sends logs to Papertrail.
			 */
			papertrail: {

				/**
				 * Whether to send HTTP access log to Papertrail
				 */
				access: false,

				/**
				 * Whether to send application log to Papertrail
				 */
				app: false,

				/**
				 * Papertrail configuration. Must be set if at least
				 * one of the two above is set to true.
				 *
				 * @see https://github.com/kenperkins/winston-papertrail#usage
				 */
				options: {
					host: '',
					port: '',
					program: 'vpdb-staging',
					colorize: true
				}
			},

			slack: {
				enabled: false,
				token: '',
				channels: {
					eventLog: '',
					userLog: '',
					general: ''
				}
			}
		},

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
			plans: [
				{ id: 'free', credits: 5, per: 'day', enableAppTokens: true, enableRealtime: false },
				{ id: 'bronze', credits: 50, per: 'day', enableAppTokens: true, enableRealtime: false },
				{ id: 'silver', credits: 200, per: 'day', enableAppTokens: true, enableRealtime: false },
				{ id: 'gold', credits: 5000, per: 'day', enableAppTokens: true, enableRealtime: false },
				{ id: 'unlimited', unlimited: true, enableAppTokens: true, enableRealtime: false }
			],

			/**
			 * The default plan which is assigned to new users.
			 */
			defaultPlan: 'free',

			/**
			 * How many credits are debited per download. Give the file type as
			 * key.
			 *
			 * Values are either -1 (public, no access control), 0 (free but
			 * user must be logged), and n (number credits).
			 *
			 * See [1] for a list of file types.
			 *
			 * If you want to distinguish between the actual file and its
			 * variations, add a "variation" sub-config with the variation
			 * name as keys.
			 *
			 * IMPORTANT: Don't change -1 values after you have set them, or
			 * files won't be accessible anymore. This is due to public files
			 * being served from a different folder so we can make Nginx or even
			 * a CDN host them.
			 *
			 * [1] https://github.com/freezy/node-vpdb/blob/master/server/modules/filetypes.js
			 */
			costs: {
				'backglass': { category: { video: 1, image: 0 }, variation: -1 },   // bg vids: 1 credit, bg imgs: free, any variation: public
				'logo': { category: 0, variation: -1 },                             // original logo: free, any variation: public
				'playfield-fs': { category: { video: 1, image: 0 }, variation: -1 },
				'playfield-ws': { category: { video: 1, image: 0 }, variation: { medium: { type: { image: 1 }}, '*': -1 } },
				'release': { category: { table: 1, '*': 0 } },                      // any type or variation: 1 credit
				'rom': 0
			}
		},

		/**
		 * Parameters about the rating metrics.
		 */
		metrics: {

			/**
			 * The sort-by-rating algorithm uses a formula similar to IMDB's Top
			 * Rated 250 Titles. It is basically a weighted arithmetic mean
			 * which pulls the score closer towards a global average when the
			 * number of votes is below a a given number.
			 *
			 * Generally speaking, games with very few ratings will have a score
			 * weighted towards the average across all games, while games with
			 * many ratings will have a score weighted towards its average
			 * rating.
			 */
			bayesianEstimate: {

				/**
				 * Weight given to the prior estimate (estimate based on
				 * distribution of average ratings across the pool of all games)
				 */
				minVotes: 30,

				/**
				 * Mean across the whole pool. If set to null, it is calculated
				 * each time a rating is submitted (and scores will be re-computed).
				 */
				globalMean: null
			}
		},

		/**
		 * Restrict content
		 */
		restrictions: {

			/**
			 * Restrict releases
			 */
			release: {

				/**
				 * Don't allow releases for Stern S.A.M (54) and SPIKE (61) games
				 */
				denyMpu: [ 54, 61 ]
			},

			/**
			 * Restrict backglasses
			 */
			backglass: {

				/**
				 * Don't allow backglasses for Stern S.A.M (54) and SPIKE (61) games
				 */
				denyMpu: [ 54, 61 ]
			},

			/**
			 * Restrict ROMs
			 */
			rom: {

				/**
				 * Don't allow ROMs for Stern S.A.M (54) and SPIKE (61) games
				 */
				denyMpu: [ 54, 61 ]
			}
		},

		/**
		 * Pusher settings
		 * See https://github.com/pusher/pusher-http-node
		 */
		pusher: {

			/**
			 * Set true for realtime support.
			 */
			enabled: false,

			/**
			 * Options passed to the library
			 */
			options: {
				appId: '',
				key: '',
				secret: '',
				encrypted: true
			}
		},

		/**
		 * Configure login strategies here.
		 */
		passport: {

			/**
			 * Google. You'll need to create a project here:
			 *    https://console.developers.google.com/
			 */
			google: {

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
		 * Uploads table file to Tom's service in order to obtain a screenshot.
		 * Only enable in production.
		 */
		generateTableScreenshot: false,

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
	},

	/**
	 * Web application-specific options.
	 */
	webapp: {
		/**
		 * Google Analytics
		 */
		ga: {
			enabled: false,
			id: ''
		}
	}

	// this is optional:
	//, ffmpeg: { path: '/opt/bin/ffmpeg' }

};
