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

import { existsSync, lstatSync } from 'fs';
import { isArray, isBoolean, isNumber, isObject, isString, keys } from 'lodash';
import { dirname } from 'path';
import { isEmail, isLength } from 'validator';
import { fileTypes } from '../files/file.types';
import { VpdbConfig } from './typings/config';

export const setttingValidations = {
	vpdb: {
		name: (name: any) => {
			if (!isLength(name, 1)) {
				return 'Name must contain at least one character.';
			}
		},
		api: { hostname: checkHost, port: checkPort, protocol: checkProtocol, pathname: checkPath },
		storage: {
			public: { path: checkFolder, api: { hostname: checkHost, port: checkPort, protocol: checkProtocol, pathname: checkPath } },
			protected: { path: checkFolder, api: { hostname: checkHost, port: checkPort, protocol: checkProtocol, pathname: checkPath } },
		},
		webapp: { hostname: checkHost, port: checkPort, protocol: checkProtocol },
		db: (db: any) => {
			if (!/mongodb:\/\/[^\/]+\/[a-z0-9]+/i.test(db)) {
				return 'Database must fit the scheme "mongodb://<host>/<db-name>"';
			}
		},
		redis: {
			host: (host: any) => {
				const validIp = !/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(host);
				const validHost = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]).)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/.test(host);
				if (!validIp && !validHost) {
					return 'Must be a valid host or IP address';
				}
			},
			port: checkPort,
			db: (db: any) => {
				if (parseInt(db, 10) > 15 || parseInt(db, 10) < 0) {
					return 'Redis database must be an integer between 0 and 15';
				}
			},
		},
		apiTokenLifetime: (timeout: any) => {
			if (!parseInt(timeout, 10) || parseInt(timeout, 10) < 1) {
				return 'API token lifetime must be a number greater than 0';
			}
		},
		storageTokenLifetime: (timeout: any) => {
			if (!parseInt(timeout, 10) || parseInt(timeout, 10) < 1) {
				return 'Ticket token lifetime must be a number greater than 0';
			}
		},
		secret: (secret: any) => {
			if (secret.length < 10) {
				return 'Your secret must be longer than 10 characters. Please use a generator, e.g. http://strongpasswordgenerator.com/';
			}
			if (secret === 'alongsecret') {
				return 'You\'re using the default secret. Please use a generator, e.g. http://strongpasswordgenerator.com/';
			}
		},
		loginBackoff: {
			delay: (delay: any) => {
				if (!isArray(delay)) {
					return 'Delay must be an array of integers.';
				}
				for (const d of delay) {
					if (!isNumber(d)) {
						return 'Delay must be an array of integers.';
					}
				}
			},
			keep: (keep: any) => {
				if (!isNumber(keep)) {
					return 'Keep duration must be a number.';
				}
			},
		},

		logging: {
			level: (level: any) => {
				if (![ 'silly', 'debug', 'verbose', 'info', 'warn', 'error' ].includes(level)) {
					return 'Log level must be one of: [ silly, debug, verbose, info, warn, error ].';
				}
			},
			console: {
				access: (bool: any) => {
					if (!isBoolean(bool)) {
						return 'Console access log must be either true or false';
					}
				},
				app: (bool: any) => {
					if (!isBoolean(bool)) {
						return 'Console application log must be either true or false';
					}
				},
			},
			file: {
				access: (logPath: any) => {
					if (!logPath) {
						return null;
					}
					const logDir = dirname(logPath);
					if (!existsSync(logDir)) {
						return 'Access log path does not exist.';
					}
					if (!lstatSync(logDir).isDirectory()) {
						return 'Access log path is not a folder.';
					}
				},
				app: (logPath: any) => {
					if (!logPath) {
						return null;
					}
					const logDir = dirname(logPath);
					if (!existsSync(logDir)) {
						return 'App log path does not exist.';
					}
					if (!lstatSync(logDir).isDirectory()) {
						return 'App log path is not a folder.';
					}
				},
			},
			papertrail: {
				access: (bool: any) => {
					if (!isBoolean(bool)) {
						return 'Papertrail access log must be either true or false';
					}
				},
				app: (bool: any) => {
					if (!isBoolean(bool)) {
						return 'Papertrail application log must be either true or false';
					}
				},
				options: (bool: any) => {
					if (!isObject(bool)) {
						return 'Papertrail config must be at least an object, even if it\'s empty.';
					}
				},
			},
		},
		email: {
			confirmUserEmail: (bool: any) => {
				if (!isBoolean(bool)) {
					return 'User email confirmation must be either true or false';
				}
			},
			sender: {
				email: (email: any) => {
					if (!isEmail(email)) {
						return 'Sender email must be a valid email address.';
					}
				},
				name: (name: any) => {
					if (!isLength(name, 1)) {
						return 'Sender name must contain at least one character.';
					}
				},
			},
			nodemailer: (obj: any) => {
				if (!isObject(obj)) {
					return 'Nodemailer configuration must be an object.';
				}
			},
		},
		quota: {
			plans: (plans: any) => {
				const durations = ['minute', 'hour', 'day', 'week'];
				if (!isArray(plans)) {
					return 'Plans must be an array. You might need to migrate: Change to array and move key into "id" attribute.';
				}
				if (plans.length < 1) {
					return 'Quota plans must contain at least one plan.';
				}
				const errors: any[] = [];
				plans.forEach(plan => {
					if (plan.unlimited !== true) {
						if (!durations.includes(plan.per)) {
							errors.push({
								path: plan.id + '.per',
								message: 'Invalid duration. Valid durations are: ["' + durations.join('", "') + '"].',
								setting: plan.per,
							});
						}
						if (!isNumber(parseInt(plan.credits, 10)) || parseInt(plan.credits, 10) < 0) {
							errors.push({
								path: plan.id + '.credits',
								message: 'Credits must be an integer equal or greater than 0.',
								setting: plan.credits,
							});
						}
						if (!isBoolean(plan.enableAppTokens)) {
							return 'Plan must define whether app tokens are allowed or not.';
						}
						if (!isBoolean(plan.enableRealtime)) {
							return 'Plan must define whether real time is enabled or not.';
						}
					}
				});
				if (errors.length > 0) {
					return errors;
				}
			},
			defaultPlan: (defaultPlan: any, setting: any, settings: VpdbConfig) => {
				if (!settings.vpdb.quota.plans.find(p => p.id === defaultPlan)) {
					return 'Default plan must exist in the "vpdb.quota.plans" setting.';
				}
			},
			costs: (costs: any) => {
				let cost;
				const errors: any[] = [];
				for (const fileType of keys(costs)) {
					cost = costs[fileType];
					if (!fileTypes.exists(fileType)) {
						errors.push({
							path: fileType,
							message: 'Invalid file type. Valid file types are: ["' + fileTypes.names.join('", "') + '"].',
							setting: fileType,
						});
					}
					if (!isNumber(cost) && !isObject(cost)) {
						errors.push({
							path: fileType,
							message: 'Cost must be an integer or object.',
							setting: cost,
						});
					}
				}
				if (errors.length > 0) {
					return errors;
				}
			},
		},
		metrics: {
			bayesianEstimate: {
				minVotes: (votes: any) => {
					if (!isNumber(votes)) {
						return 'Must be a number';
					}
				},
				globalMean: (mean: any) => {
					if (mean !== null && !isNumber(mean)) {
						return 'Must be either null or a number';
					}
				},
			},
		},
		restrictions: {
			release: {
				denyMpu: (ids: any) =>  {
					if (!isArray(ids)) {
						return 'Denied MPUs must be an array.';
					}
				},
			},
			backglass: {
				denyMpu: (ids: any) => {
					if (!isArray(ids)) {
						return 'Denied MPUs must be an array.';
					}
				},
			},
			rom: {
				denyMpu: (ids: any) => {
					if (!isArray(ids)) {
						return 'Denied MPUs must be an array.';
					}
				},
			},
		},
		passport: {
			google: {
				enabled: (isEnabled: any) => {
					if (!isBoolean(isEnabled)) {
						return 'Enabled flag must be either true or false';
					}
				},
				clientID: (id: any, setting: any) => {
					if (!setting.enabled) {
						return;
					}
					if (id.length === 0) {
						return 'Your client ID must be longer than 0 characters.';
					}
				},
				clientSecret: (secret: any, setting: any) => {
					if (!setting.enabled) {
						return;
					}
					if (secret.length === 0) {
						return 'Your client secret must be longer than 0 characters.';
					}
					if (secret === 'CLIENT_SECRET') {
						return 'You\'re using the default client secret.';
					}
				},
			},
			github: {
				enabled: (isEnabled: any) => {
					if (!isBoolean(isEnabled)) {
						return 'Enabled flag must be either true or false';
					}
				},
				clientID: (id: any, setting: any) => {
					if (!setting.enabled) {
						return;
					}
					if (id.length === 0) {
						return 'Your client ID must be longer than 0 characters. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client ID';
					}
				},
				clientSecret: (secret: any, setting: any) => {
					if (!setting.enabled) {
						return;
					}
					if (secret.length === 0) {
						return 'Your client secret must be longer than 0 characters. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client secret';
					}
					if (secret === 'CLIENT_SECRET') {
						return 'You\'re using the default client secret. Please consult https://github.com/settings/applications/ in order to obtain GitHub\'s client secret';
					}
				},
			},
			ipboard: {
				enabled: (isEnabled: any) => {
					if (!isBoolean(isEnabled)) {
						return 'Enabled flag must be either true or false';
					}
				},
				id: (id: any, setting: any) => {
					if (!setting.enabled) {
						return;
					}
					if (!/^[a-z0-9_-]+$/.test(id)) {
						return 'ID must be alphanumeric';
					}
				},
				baseURL: (url: any, setting: any) => {
					if (!setting.enabled) {
						return;
					}
					const urlErr = checkUrl(url);
					if (urlErr) {
						return urlErr;
					}
				},
				clientID: (id: any, setting: any) => {
					if (!setting.enabled) {
						return;
					}
					if (id.length === 0) {
						return 'Your client ID must be longer than 0 characters';
					}
				},
				clientSecret: (secret: any, setting: any) => {
					if (!setting.enabled) {
						return;
					}
					if (secret.length === 0) {
						return 'Your client secret must be longer than 0 characters';
					}
					if (secret === 'CLIENT_SECRET') {
						return 'You\'re using the default client secret';
					}
				},
				version: (version: any, setting: any) => {
					if (!setting.enabled) {
						return;
					}
					if (version !== 3 && version !== 4 && version !== 4.3) {
						return 'IPS version must be either 3, 4 or 4.3';
					}
				},
				__array: true,
			},
		},
		tmp: (path: any) => {
			if (!existsSync(path)) {
				return 'Temp path does not exist. Please point it to an existing folder or create the mentioned path';
			}
			if (!lstatSync(path).isDirectory()) {
				return 'Temp path is not a folder. Please make it point to a folder';
			}
		},

		authorizationHeader: (header: any) => {
			if (header.length === 0) {
				return 'Your authorization header must be longer than 0 characters';
			}
		},
		generateTableScreenshot: (bool: any) => {
			if (!isBoolean(bool)) {
				return 'Option "generateTableScreenshot" must be either true or false';
			}
		},
		services: {
			raygun: {
				enabled: (isEnabled: any) => {
					if (!isBoolean(isEnabled)) {
						return 'Enabled flag must be either true or false';
					}
				},
				apiKey: (apiKey: any) => {
					if (!isString(apiKey)) {
						return 'API key must be a string';
					}
				},
			},
			sqreen: {
				enabled: (isEnabled: any) => {
					if (!isBoolean(isEnabled)) {
						return 'Enabled flag must be either true or false';
					}
				},
				token: (token: any) => {
					if (!isString(token)) {
						return 'Token must be a string';
					}
				},
			},
		},
	},
};

function checkUrl(str: any) {
	const pattern = new RegExp(
		'^' +
		// protocol identifier
		'(?:(?:https?)://)' +
		// user:pass authentication
		'(?:\\S+(?::\\S*)?@)?' +
		'(?:' +
		// IP address dotted notation octets
		// excludes loopback network 0.0.0.0
		// excludes reserved space >= 224.0.0.0
		// excludes network & broacast addresses
		// (first & last IP address of each class)
		'(?:[1-9]\\d?|1\\d\\d|2[01]\\d|22[0-3])' +
		'(?:\\.(?:1?\\d{1,2}|2[0-4]\\d|25[0-5])){2}' +
		'(?:\\.(?:[1-9]\\d?|1\\d\\d|2[0-4]\\d|25[0-4]))' +
		'|localhost|' +
		// host name
		'(?:(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)' +
		// domain name
		'(?:\\.(?:[a-z\\u00a1-\\uffff0-9]+-?)*[a-z\\u00a1-\\uffff0-9]+)*' +
		// TLD identifier
		'(?:\\.(?:[a-z\\u00a1-\\uffff]{2,}))' +
		')' +
		// port number
		'(?::\\d{2,5})?' +
		// resource path
		'(?:/[^\\s]*)?' +
		'$', 'i',
	);
	/* istanbul ignore if */
	if (!pattern.test(str)) {
		return 'Must be a valid URL';
	}
}

function checkHost(host: any) {
	const validIp = !/^(([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])\.){3}([0-9]|[1-9][0-9]|1[0-9]{2}|2[0-4][0-9]|25[0-5])$/.test(host);
	const validHost = /^(([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]).)*([A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]*[A-Za-z0-9])$/.test(host);
	/* istanbul ignore if */
	if (!validIp && !validHost) {
		return 'Must be a valid host or IP address';
	}
}

function checkPort(port: any) {
	if (!parseInt(port, 10) || parseInt(port, 10) > 65535 || parseInt(port, 10) < 1) {
		return 'Port must be an integer between 1 and 65535';
	}
}

function checkProtocol(protocol: any) {
	if (protocol !== 'http' && protocol !== 'https') {
		return 'Schema must be either "http" or "https".';
	}
}

function checkPath(path: any) {
	if (!isString(path) || (path.length > 0 && path[0] !== '/')) {
		return 'Path must start with "/".';
	}
}

function checkFolder(path: any) {
	if (!existsSync(path)) {
		return 'Storage path does not exist. Please point it to an existing folder or create the mentioned path';
	}
	if (!lstatSync(path).isDirectory()) {
		return 'Storage path is not a folder. Please make it point to a folder';
	}
}
