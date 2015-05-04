/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

"use strict";

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var mimeTypes = require('../modules/mimetypes');
var fileTypes = require('../modules/filetypes');
var validator = require('validator');

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
		 * Public URI of the API.
		 *
		 * This is used to construct URLs. The actual server always listens on
		 * `localhost`.
		 *
		 * Note that the port is NOT what defines on which port the app listens,
		 * for that set the `PORT` environment variable. However, when running
		 * the server via Grunt, it will read this variable and set the env
		 * accordingly IF unset.
		 *
		 * @important
		 */
		api: {
			hostname: checkHost, port: checkPort, protocol: checkProtocol, pathname: checkPath
		},


		/**
		 * Public URI of the Storage API.
		 *
		 * This is used to construct URLs. The actual server always listens on
		 * `localhost`.
		 *
		 * @important
		 */
		storageApi: {
			hostname: checkHost, port: checkPort, protocol: checkProtocol, pathname: checkPath
		},

		/**
		 * Public URI of the web application.
		 *
		 * This is used to construct URLs. The actual server always listens on
		 * `localhost`.
		 *
		 * @important
		 */
		webapp: {
			hostname: checkHost, port: checkPort, protocol: checkProtocol
		},

		/**
		 * Database configuration. Must point to a MongoDB schema.
		 */
		db: function(db) {
			/* istanbul ignore if */
			if (!/mongodb:\/\/[^\/]+\/[a-z0-9]+/i.test(db)) {
				return 'Database must fit the scheme "mongodb://<host>/<db-name>"';
			}
		},

		/**
		 * Redis configuration.
		 */
		redis: {
			host: function(host) {
				var validIp = !/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(host);
				var validHost = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/.test(host);
				/* istanbul ignore if */
				if (!validIp && !validHost) {
					return 'Must be a valid host or IP address';
				}
			},

			port: function(port) {
				/* istanbul ignore if */
				if (!parseInt(port) || parseInt(port) > 65535 || parseInt(port) < 1) {
					return 'Port must be an integer between 1 and 65535';
				}
			},

			db: function(db) {
				/* istanbul ignore if */
				if (parseInt(db) > 15 || parseInt(db) < 0) {
					return 'Redis database must be an integer between 0 and 15';
				}
			}
		},

		/**
		 * Session timeout in milliseconds.
		 */
		apiTokenLifetime: function(timeout) {
			/* istanbul ignore if */
			if (!parseInt(timeout) || parseInt(timeout) < 1) {
				return 'API token lifetime must be a number greater than 0';
			}
		},

		/**
		 * Session timeout in milliseconds.
		 */
		storageTokenLifetime: function(timeout) {
			/* istanbul ignore if */
			if (!parseInt(timeout) || parseInt(timeout) < 1) {
				return 'Ticket token lifetime must be a number greater than 0';
			}
		},

		/**
		 * Secret for hashing stuff. Create something long here: http://strongpasswordgenerator.com/
		 * @important
		 */
		secret: function(secret) {
			/* istanbul ignore if */
			if (secret.length < 10) {
				return 'Your secret must be longer than 10 characters. Please use a generator, e.g. http://strongpasswordgenerator.com/';
			}
			/* istanbul ignore if */
			if (secret === 'alongsecret') {
				return 'You\'re using the default secret. Please use a generator, e.g. http://strongpasswordgenerator.com/';
			}
		},

		/**
		 * Sets various logging options.
		 */
		logging: {
			console: {
				access: function(bool) {
					/* istanbul ignore if */
					if (!_.isBoolean(bool)) {
						return 'Console access log must be either true or false';
					}
				},
				app: function(bool) {
					/* istanbul ignore if */
					if (!_.isBoolean(bool)) {
						return 'Console application log must be either true or false';
					}
				}
			},
			file: {
				access: function(logPath) {
					var logDir = path.dirname(logPath);

					/* istanbul ignore if */
					if (!fs.existsSync(logDir)) {
						return 'Access log path does not exist.';
					}
					/* istanbul ignore if */
					if (!fs.lstatSync(logDir).isDirectory()) {
						return 'Access log path is not a folder.';
					}
				},
				app: function(logPath) {
					var logDir = path.dirname(logPath);

					/* istanbul ignore if */
					if (!fs.existsSync(logDir)) {
						return 'App log path does not exist.';
					}
					/* istanbul ignore if */
					if (!fs.lstatSync(logDir).isDirectory()) {
						return 'App log path is not a folder.';
					}
				}
			},
			papertrail: {
				access: function(bool) {
					/* istanbul ignore if */
					if (!_.isBoolean(bool)) {
						return 'Papertrail access log must be either true or false';
					}
				},
				app: function(bool) {
					/* istanbul ignore if */
					if (!_.isBoolean(bool)) {
						return 'Papertrail application log must be either true or false';
					}
				},
				options: function(bool) {
					/* istanbul ignore if */
					if (!_.isObject(bool)) {
						return 'Papertrail config must be at least an object, even if it\'s empty.';
					}
				}
			}
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
			confirmUserEmail: function(bool) {
				/* istanbul ignore if */
				if (!_.isBoolean(bool)) {
					return 'User email confirmation must be either true or false';
				}
			},

			/**
			 * Sender of the automated mails
			 */
			sender: {
				email: function(email) {
					/* istanbul ignore if */
					if (!validator.isEmail(email)) {
						return 'Sender email must be a valid email address.';
					}
				},
				name: function(name) {
					/* istanbul ignore if */
					if (!validator.isLength(name, 1)) {
						return 'Sender name must contain at least one character.';
					}
				}
			},

			/**
			 * Options passed to Nodemailer
			 *
			 * @see https://github.com/andris9/nodemailer-smtp-transport
			 * @important
			 */
			nodemailer: function(obj) {
				/* istanbul ignore if */
				if (!_.isObject(obj)) {
					return 'Nodemailer configuration must be an object.';
				}
			}
		},

		/**
		 * Where the files are stored.
		 * @important
		 */
		storage: function(path) {
			/* istanbul ignore if */
			if (!fs.existsSync(path)) {
				return 'Storage path does not exist. Please point it to an existing folder or create the mentioned path';
			}
			/* istanbul ignore if */
			if (!fs.lstatSync(path).isDirectory()) {
				return 'Storage path is not a folder. Please make it point to a folder';
			}
		},

		/**
		 * Quota definitions for the site. Quotas can be used to limit the
		 * number of items a user can download in a given time.
		 */
		quota: {
			plans: function(plans) {
				var durations = ['minute', 'hour', 'day', 'week'];
				/* istanbul ignore if */
				if (_.keys(plans).length < 1) {
					return 'Quota plans must contain at least one plan.';
				}
				var plan;
				var errors = [];
				for (var key in plans) {
					if (plans.hasOwnProperty(key)) {
						plan = plans[key];
						if (plan.unlimited !== true) {
							/* istanbul ignore if */
							if (!_.contains(durations, plan.per)) {
								errors.push({
									path: key + '.per',
									message: 'Invalid duration. Valid durations are: ["' + durations.join('", "') + '"].',
									setting: plan.per
								});
							}
							/* istanbul ignore if */
							if (!_.isNumber(parseInt(plan.credits)) || parseInt(plan.credits) < 0) {
								errors.push({
									path: key + '.credits',
									message: 'Credits must be an integer equal or greater than 0.',
									setting: plan.credits
								});
							}
						}
					}
				}
				/* istanbul ignore if */
				if (errors.length > 0) {
					return errors;
				}
			},

			defaultPlan: function(defaultPlan, settings) {
				/* istanbul ignore if */
				if (!settings.vpdb.quota.plans[defaultPlan]) {
					return 'Default plan must exist in the "vpdb.quota.plans" setting.';
				}
			},

			costs: function(costs) {
				var cost, errors = [];
				for (var fileType in costs) {
					if (costs.hasOwnProperty(fileType)) {
						cost = costs[fileType];
						/* istanbul ignore if */
						if (!fileTypes.exists(fileType)) {
							errors.push({
								path: fileType,
								message: 'Invalid file type. Valid file types are: ["' + fileTypes.keys().join('", "') + '"].',
								setting: fileType
							});
						}
						/* istanbul ignore if */
						if (!_.isNumber(cost) && !_.isObject(cost)) {
							errors.push({
								path: fileType,
								message: 'Cost must be an integer or object.',
								setting: cost
							});
						}
					}
				}
				/* istanbul ignore if */
				if (errors.length > 0) {
					return errors;
				}
			}
		},

		metrics: {
			bayesianEstimate: {
				minVotes: function(votes) {
					/* istanbul ignore if */
					if (!_.isNumber(votes)) {
						return 'Must be a number';
					}
				},
				globalMean: function(mean) {
					/* istanbul ignore if */
					if (mean !== null && !_.isNumber(mean)) {
						return 'Must be either null or a number';
					}
				}
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
					/* istanbul ignore if */
					if (!_.isBoolean(isEnabled)) {
						return 'Enabled flag must be either true or false';
					}
				},

				/**
				 * The client ID of the generated application.
				 */
				clientID: function(id, settings) {
					/* istanbul ignore if */
					if (!settings.vpdb.passport.enabled) {
						return;
					}
					/* istanbul ignore if */
					if (id.length === 0) {
						return 'Your client ID must be longer than 0 characters. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client ID';
					}
					/* istanbul ignore if */
					if (id === 'CLIENT_ID') {
						return 'You\'re using the default client ID. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client ID';
					}
				},

				/**
				 * The client secret of the generated application.
				 */
				clientSecret: function(secret, settings) {
					/* istanbul ignore if */
					if (!settings.vpdb.passport.enabled) {
						return;
					}
					/* istanbul ignore if */
					if (secret.length === 0) {
						return 'Your client secret must be longer than 0 characters. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client secret';
					}
					/* istanbul ignore if */
					if (secret === 'CLIENT_SECRET') {
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
					/* istanbul ignore if */
					if (!_.isBoolean(isEnabled)) {
						return 'Enabled flag must be either true or false';
					}
				},

				/**
				 * Must contain only letters from a-z (no spaces or special chars).
				 */
				id: function(id) {
					/* istanbul ignore if */
					if (!/^[a-z0-9]+$/.test(id)) {
						return 'ID must be alphanumeric';
					}
				},

				/**
				 * Index file of the forum.
				 */
				baseURL: function(url) {
					var urlErr = checkUrl(url);
					/* istanbul ignore if */
					if (urlErr) {
						return urlErr;
					}
					/* istanbul ignore if */
					if (url === 'https://localhost/forums/index.php') {
						return 'You\'re using the default base URL';
					}
				},

				/**
				 * The client ID of the generated application.
				 */
				clientID: function(id) {
					/* istanbul ignore if */
					if (id.length === 0) {
						return 'Your client ID must be longer than 0 characters';
					}
					/* istanbul ignore if */
					if (id === 'CLIENT_ID') {
						return 'You\'re using the default client ID';
					}
				},

				/**
				 * The client secret of the generated application.
				 */
				clientSecret: function(secret) {
					/* istanbul ignore if */
					if (secret.length === 0) {
						return 'Your client secret must be longer than 0 characters';
					}
					/* istanbul ignore if */
					if (secret === 'CLIENT_SECRET') {
						return 'You\'re using the default client secret';
					}
				},

				__array: true
			}
		},

		/**
		 * A temp folder for extracting stuff. No trailing slash!
		 * @important
		 */
		tmp: function(path) {
			/* istanbul ignore if */
			if (!fs.existsSync(path)) {
				return 'Temp path does not exist. Please point it to an existing folder or create the mentioned path';
			}

			/* istanbul ignore if */
			if (!fs.lstatSync(path).isDirectory()) {
				return 'Temp path is not a folder. Please make it point to a folder';
			}
		},

		/**
		 * HTTP header where the JWT is send from the client. If you globally
		 * protect the site with let's say HTTP Basic, you'd need to use
		 * different name for the authorization header.
		 */
		authorizationHeader: function(header) {
			/* istanbul ignore if */
			if (header.length === 0) {
				return 'Your authorization header must be longer than 0 characters';
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
	/* istanbul ignore if */
	if (!pattern.test(str)) {
		return 'Must be a valid URL';
	}
}

function checkHost(host) {
	var validIp = !/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(host);
	var validHost = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]*[a-zA-Z0-9])\.)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9\-]*[A-Za-z0-9])$/.test(host);
	/* istanbul ignore if */
	if (!validIp && !validHost) {
		return 'Must be a valid host or IP address';
	}
}

function checkPort(port) {
	/* istanbul ignore if */
	if (!parseInt(port) || parseInt(port) > 65535 || parseInt(port) < 1) {
		return 'Port must be an integer between 1 and 65535';
	}
}

function checkProtocol(protocol) {
	/* istanbul ignore if */
	if (protocol !== 'http' && protocol !== 'https') {
		return 'Schema must be either "http" or "https".';
	}
}

function checkPath(path) {
	if (!_.isString(path) || path[0] !== '/') {
		return 'Path must start with "/".';
	}
}