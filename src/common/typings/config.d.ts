/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

/**
 * Global settings file for VPDB.
 *
 * Take special care of @important settings. These are settings where the
 * default value probably doesn't work with your environment. For the others,
 * the default value probably works okay.
 */
export interface VpdbConfig {

	/**
	 * Application-specific settings.
	 */
	vpdb: {

		/**
		 * Name of the application
		 *
		 * @important
		 */
		name: string,

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
		api: VpdbHost,

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
				path: string,

				/** URI of the API. Used to construct URLs. */
				api: VpdbHost,
			},

			/**
			 * Protected files (need authentication, even if download might be free).
			 */
			'protected': {

				/** Path on the file system */
				path: string,

				/** URI of the API. Used to construct URLs. */
				api: VpdbHost,
			},
		},

		/**
		 * Public URI of the web application.
		 *
		 * This is used to construct URLs. The actual server always listens on
		 * `localhost`.
		 *
		 * @important
		 */
		webapp: VpdbHost,

		/**
		 * Lifetime of the API JWT in milliseconds.
		 */
		apiTokenLifetime: number,

		/**
		 * Lifetime of the ticket token in the URL for images and videos, in milliseconds.
		 */
		storageTokenLifetime: number,

		/**
		 * Database configuration. Must point to a MongoDB schema.
		 */
		db: string,

		/**
		 * Redis configuration.
		 */
		redis: {
			host: string,
			port: number,
			db: number,
		},

		/**
		 * Secret for hashing and signing. Create something long here: http://strongpasswordgenerator.com/
		 * @important
		 */
		secret: string,

		/**
		 * When the user fails to login with user/pass or token, block logins for
		 * the IP address.
		 */
		loginBackoff: {

			/**
			 * How long the IP adress is blocked. Index in array is number of
			 * seconds to wait for the nth time. If n > array length, the last
			 * delay is applied.
			 */
			delay: number[],

			/**
			 * Keep counter during this time in seconds. That means that once
			 * the user fails to login, the counter will continue to increase
			 * during that time even if a successful login occurs.
			 */
			keep: number,
		},

		/**
		 * Various mail settings.
		 */
		email: {

			/**
			 * If true, user email address is validated on registration and
			 * change. Otherwise, email addresses are only syntactically
			 * validated.
			 */
			confirmUserEmail: boolean,

			/**
			 * Sender of the automated mails
			 */
			sender: {
				email: string,
				name: string,
			},

			/**
			 * Options passed to Nodemailer
			 *
			 * @see https://github.com/andris9/nodemailer-smtp-transport
			 * @important
			 */
			nodemailer: {
				host: string,
				port: number,
				auth: {
					user: string,
					pass: string,
				},
			},
		},

		/**
		 * Sets various logging options.
		 */
		logging: {

			/**
			 * Log level. Allowed values: [ 'silly', 'debug', 'verbose', 'info', 'warn', 'error' ]
			 */
			level: 'silly' | 'debug' | 'verbose' | 'info' | 'warn' | 'error',

			/**
			 * Prints log to the current console. Should not be used in production.
			 */
			console: {
				/**
				 * Whether to log HTTP file access
				 */
				access: boolean,
				/**
				 * Whether to log application data
				 */
				app: boolean,
			},

			/**
			 * Writes log to a file. Rotation etc should be done externally.
			 */
			file: {
				/**
				 * File location of the HTTP access log. Null or empty for no logging.
				 */
				access: string,
				/**
				 * File location of the application log. Null or empty for no logging.
				 */
				app: string,
			},

			/**
			 * Sends logs to Papertrail.
			 */
			papertrail: {

				/**
				 * Whether to send HTTP access log to Papertrail
				 */
				access: boolean,

				/**
				 * Whether to send application log to Papertrail
				 */
				app: boolean,

				/**
				 * Papertrail configuration. Must be set if at least
				 * one of the two above is set to true.
				 *
				 * @see https://github.com/kenperkins/winston-papertrail#usage
				 */
				options: {
					host: string,
					port: number,
					program: string,
					colorize: boolean,
				},
			},

			slack: {
				enabled: boolean,
				token: string,
				channels: {
					eventLog: string,
					userLog: string,
					general: string,
				},
			},
		},

		/**
		 * Quota definitions for the site. Quotas can be used to limit the
		 * number of items a user can download in a given time.
		 */
		quota: VpdbQuotaConfig,

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
				minVotes: number,

				/**
				 * Mean across the whole pool. If set to null, it is calculated
				 * each time a rating is submitted (and scores will be re-computed).
				 */
				globalMean: number,
			},
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
				denyMpu: number[],
			},

			/**
			 * Restrict backglasses
			 */
			backglass: {

				/**
				 * Don't allow backglasses for Stern S.A.M (54) and SPIKE (61) games
				 */
				denyMpu: number[],
			},

			/**
			 * Restrict ROMs
			 */
			rom: {

				/**
				 * Don't allow ROMs for Stern S.A.M (54) and SPIKE (61) games
				 */
				denyMpu: number[],
			},
			[key: string]: { denyMpu: number[] };
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
				enabled: boolean,

				/**
				 * The client ID of the generated application.
				 * @important
				 */
				clientID: string,

				/**
				 * The client secret of the generated application.
				 * @important
				 */
				clientSecret: string,
			},

			/**
			 * GitHub. You'll need to create an application here:
			 *    https://github.com/settings/applications/
			 */
			github: {

				/**
				 * Set false to disable.
				 */
				enabled: boolean,

				/**
				 * The client ID of the generated application.
				 * @important
				 */
				clientID: string,

				/**
				 * The client secret of the generated application.
				 * @important
				 */
				clientSecret: string,
			},

			/**
			 * IP.Board OAuth2 authentication.
			 * You'll need to install the ipb-oauth2-server application here:
			 *        https://github.com/freezy/ipb-oauth2-server
			 *
			 * You can also add multiple entries if you like to offer authentication from multiple boards.
			 */
			ipboard: VpdbIpsConfig[],
		},

		/**
		 * Uploads table file to Tom's service in order to obtain a screenshot.
		 * Only enable in production.
		 */
		generateTableScreenshot: boolean,

		/**
		 * A temp folder for extracting stuff. No trailing slash!
		 * @important
		 */
		tmp: string,

		/**
		 * HTTP header where the JWT is send from the client. If you globally
		 * protect the site with let's say HTTP Basic, you'd need to use
		 * different name for the authorization header.
		 */
		authorizationHeader: string,

		/**
		 * Additional third-party services
		 */
		services: {

			/**
			 * Crash reporting
			 */
			raygun: {
				enabled: boolean,
				apiKey: string,
				tag: string,
			};

			/**
			 * Crash reporting
			 */
			rollbar: {
				enabled: boolean,
				apiKey: string,
				environment: string,
			};
		},
	};

	ffmpeg?: {

		/**
		 * Path to the ffmpeg binary.
		 */
		path: string;
	};
}

export interface VpdbIpsConfig {
	/**
	 * Set false to disable.
	 */
	enabled: boolean;

	/**
	 * Must contain only letters or numbers (no spaces or special chars).
	 */
	id: string;

	/**
	 * Label of the button
	 */
	name: string;

	/**
	 * Index file of the forum.
	 */
	baseURL: string;

	/**
	 * The client ID of the generated application.
	 * @important
	 */
	clientID: string;

	/**
	 * The client secret of the generated application.
	 * @important
	 */
	clientSecret: string;

	/**
	 * Version of the IPS board. Either `3` or `4`.
	 */
	version: 3 | 4 | 4.3;
}

export interface VpdbHost {
	protocol: 'https' | 'http';
	hostname: string;
	port: number;
	pathname?: string;
	prefix?: string;
}

export interface VpdbQuotaConfigPlan {
	id: string;
	credits: number;
	per: 'day' | 'hour' | 'minute';
	enableAppTokens: boolean;
	enableRealtime: boolean;

	[key: string]: any;
}

export interface VpdbQuotaConfig {
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
	plans: VpdbQuotaConfigPlan[];

	/**
	 * The default plan which is assigned to new users.
	 */
	defaultPlan: string;

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
	 * [1] https://github.com/vpdb/backend/blob/master/src/modules/filetypes.js
	 */
	costs: { [key: string]: number | VpdbPlanCost };
}

export interface VpdbPlanCost {
	category?: number | VpdbPlanCategoryCost;
	variation?: number;
}

export interface VpdbPlanCategoryCost {
	video: number;
	image: number;
	table: number;
	'*': number;
	[key: string]: number;
}
