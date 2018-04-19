/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const logger = require('winston');
const shortId = require('shortid32');
const mongoose = require('mongoose');
const validator = require('validator');
const randomstring = require('randomstring');
const uniqueValidator = require('mongoose-unique-validator');
const metrics = require('../../src_/models/plugins/metrics');

const UserSerializer = require('./user.serializer');
const config = require('../common/settings').current;
const flavor = require('../../src_/modules/flavor');
const mailer = require('../common/mailer');
const Schema = mongoose.Schema;


//-----------------------------------------------------------------------------
// SCHEMA
//-----------------------------------------------------------------------------
const fields = {
	id: { type: String, required: true, unique: true, 'default': shortId.generate },
	name: { type: String, index: true, required: 'Name must be provided.' }, // display name, equals username when locally registering.
	username: { type: String, index: true, unique: true, sparse: true },     // login name when logging locally, empty if oauth
	email: { type: String, index: true, unique: true, lowercase: true, required: 'Email must be provided.' },
	email_status: {
		code: { type: String, 'enum': ['confirmed', 'pending_registration', 'pending_update'], required: true },
		token: { type: String },
		expires_at: { type: Date },
		value: { type: String }
	},
	emails: { type: [String], index: true }, // collected from profiles
	roles: { type: [String], required: 'Roles must be provided.' },
	_plan: { type: String, required: 'Plan must be provided.' },
	is_local: { type: Boolean, required: true },
	providers: {},
	password_hash: { type: String },
	password_salt: { type: String },
	thumb: { type: String },
	location: { type: String },
	preferences: {
		tablefile_name: { type: String },
		flavor_tags: { type: Schema.Types.Mixed },
		notify_release_moderation_status: { type: Boolean, 'default': true },
		notify_release_validation_status: { type: Boolean, 'default': true },
		notify_backglass_moderation_status: { type: Boolean, 'default': true },
		notify_game_requests: { type: Boolean, 'default': true },
		notify_created_release_comments: { type: Boolean, 'default': true },
		notify_created_release_followers: { type: Boolean, 'default': true }, // not implemented
		notify_mentions: { type: Boolean, 'default': true },                  // not implemented
		contributor_notify_game_request_created: { type: Boolean, 'default': true }, // not implemented
		moderator_notify_release_submitted: { type: Boolean, 'default': true },
		moderator_notify_release_auto_approved: { type: Boolean, 'default': false },
		moderator_notify_release_commented: { type: Boolean, 'default': true },
		moderator_notify_backglass_submitted: { type: Boolean, 'default': true },
		moderator_notify_backglass_auto_approved: { type: Boolean, 'default': false }
	},
	credits: { type: Schema.Types.Number },
	counter: {
		comments: { type: Number, 'default': 0 },
		downloads: { type: Number, 'default': 0 },
		stars: { type: Number, 'default': 0 }
	},
	created_at: { type: Date, required: true },
	is_active: { type: Boolean, required: true, 'default': false },
	validated_emails: { type: [String], index: true },
	channel_config: {
		subscribe_to_starred: { type: Boolean, 'default': false }, // "nice to know", useless
		subscribed_releases: { type: [String], index: true }     // linked releases on client side, so we can announce properly in realtime
	}
};
const providerSchema = new mongoose.Schema({
	id: { type: String, required: 'Provider ID is required.', index: true },
	name: { type: String },
	emails: { type: [String], required: false },
	created_at: { type: Date, required: true },
	modified_at: { type: Date },
	profile: {}
});

// provider data fields
if (config.vpdb.passport.github.enabled) {
	fields.providers.github = providerSchema;
}
if (config.vpdb.passport.google.enabled) {
	fields.providers.google = providerSchema;
}
config.vpdb.passport.ipboard.forEach(function(ipbConfig) {
	if (ipbConfig.enabled) {
		fields.providers[ipbConfig.id] = providerSchema;
	}
});
const UserSchema = new Schema(fields, { usePushEach: true });
UserSchema.index({ name: 'text', username: 'text', email: 'text' });
UserSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });


//-----------------------------------------------------------------------------
// PLUGINS
//-----------------------------------------------------------------------------

UserSchema.plugin(metrics);


//-----------------------------------------------------------------------------
// VIRTUALS
//-----------------------------------------------------------------------------

UserSchema.virtual('password')
	.set(function(password) {
		this._password = password;
		this.password_salt = this.makeSalt();
		this.password_hash = this.hashPassword(password);
	})
	.get(function() {
		return this._password;
	});

UserSchema.virtual('planConfig')
	.get(function() {
		let plan = _.find(config.vpdb.quota.plans, p => p.id === this._plan);
		if (!plan) {
			logger.warn('[model|user] Cannot find plan "%s" for user "%s" in server config.', this._plan, this.email);
			plan = _.find(config.vpdb.quota.plans, p => p.id === config.vpdb.quota.defaultPlan);
		}
		return plan;
	});

UserSchema.virtual('provider')
	.get(function() {
		return _.find(_.keys(this.providers), p => this.providers[p] && this.providers[p].id) || 'local';
	});

//-----------------------------------------------------------------------------
// MIDDLEWARE
//-----------------------------------------------------------------------------

// UserSchema.pre('validate', function(next) {
// 	const user = this.toJSON();
// 	if (this.isNew && !this.name) {
// 		if (user.username) {
// 			this.name = user.username;
// 		}
// 		// if (user.providers && !_.isEmpty(user.providers.github)) {
// 		// 	this.name = user.github.name ? user.providers.github.name : user.providers.github.login;
// 		// }
// 		// if (user.providers && !_.isEmpty(user.providers.google)) {
// 		// 	this.name = user.google.name ? user.google.name : user.google.login;
// 		// }
// 		// config.vpdb.passport.ipboard.forEach(function(ipbConfig) {
// 		// 	if (!_.isEmpty(user[ipbConfig.id])) {
// 		// 		this.name = user[ipbConfig.id].displayName ? user[ipbConfig.id].displayName : user[ipbConfig.id].username;
// 		// 	}
// 		// }, this);
// 	}
// 	next();
// });


//-----------------------------------------------------------------------------
// VALIDATIONS
//-----------------------------------------------------------------------------
const validNameRegex = /^[0-9a-z ]{3,}$/i;
UserSchema.path('name').validate(function(name) {
	// this gets default from username if not set anyway.
	if (this.isNew) {
		return true;
	}
	return _.isString(name) && validator.isLength(name, 3, 30);
}, 'Name must be between 3 and 30 characters.');

UserSchema.path('name').validate(function(name) {
	// this gets default from username if not set anyway.
	if (this.isNew) {
		return true;
	}
	return validNameRegex.test(name);
}, 'Name can only contain letters, numbers and spaces.');

UserSchema.path('email').validate(function(email) {
	// if you are authenticating by any of the oauth strategies, don't validate
	if (this.isNew && !this.is_local) {
		return true;
	}
	return _.isString(email) && validator.isEmail(email);
}, 'Email must be in the correct format.');

UserSchema.path('location').validate(function(location) {
	return _.isString(location) && validator.isLength(location, 0, 100);
}, 'Location must not be longer than 100 characters.');

UserSchema.path('is_local').validate(function(isLocal) {

	return Promise.try(() => {

		// validate presence of password. can't do that in the password validator
		// below because it's not run when there's no value (and it can be null,
		// if auth strategy is not local). so do it here, invalidate password if
		// necessary but return true so provider passes.
		if (this.isNew && isLocal) {
			if (!this._password) {
				this.invalidate('password', 'Password is required.');
			}
			// idem for username and email
			if (!this.username) {
				this.invalidate('username', 'Username is required.');
			}
			if (!this.email) {
				this.invalidate('email', 'Email is required.');
			}
		}
		if (isLocal) {
			if (!_.isString(this.username)) {
				this.invalidate('username', 'Username must be a string between 3 and 30 characters.');
			} else {
				if (!validator.isLength(this.username, 3, 30)) {
					this.invalidate('username', 'Username must be between 3 and 30 characters.');
				}
				if (!validator.matches(this.username, /^[a-z0-9]+$/i)) {
					this.invalidate('username', 'Username must only contain alpha-numeric characters.');
				}
			}
		}

		// TODO put this into separate validation when this is fixed: https://github.com/LearnBoost/mongoose/issues/1919
		if (this.preferences && this.preferences.tablefile_name) {
			if (!this.preferences.tablefile_name.trim()) {
				this.invalidate('preferences.tablefile_name', 'Must not be empty if set.');
			}
			let rg1 = /^[^\\/:*?"<>|]+$/;                        // forbidden characters \ / : * ? " < > |
			let rg2 = /^\./;                                     // cannot start with dot (.)
			let rg3 = /^(nul|prn|con|lpt[0-9]|com[0-9])(\.|$)/i; // forbidden file names
			if (!rg1.test(this.preferences.tablefile_name) || rg2.test(this.preferences.tablefile_name) || rg3.test(this.preferences.tablefile_name)) {
				this.invalidate('preferences.tablefile_name', 'Must be a valid windows filename, which "' + this.preferences.tablefile_name + '" is not.');
			}
		}
		if (this.preferences && this.preferences.flavor_tags) {
			_.each(flavor.values, (flavorType, flavorId) => {  // flavorId: 'orientation', flavorType: { fs: { name: 'Portrait', .. }, ws: { ... } }
				if (this.preferences.flavor_tags[ flavorId ]) {
					_.each(flavorType, (flavorAttrs, flavorValue) => { // flavorValue: 'fs', flavorAttrs: { name: 'Portrait', .. }
						if (_.isUndefined(this.preferences.flavor_tags[ flavorId ][ flavorValue ])) {
							this.invalidate('preferences.flavor_tags.' + flavorId + '.' + flavorValue, 'Must be provided when providing preferences.flavor_tags.' + flavorId + '.');
						}
					});
				} else {
					this.invalidate('preferences.flavor_tags.' + flavorId, 'Must be provided when providing preferences.flavor_tags.');
				}
			});
		}

		if (this.preferences && this.preferences.notify_release_moderation_status) {
			if (!_.isBoolean(this.preferences.notify_release_moderation_status)) {
				this.invalidate('preferences.notify_release_moderation_status', 'Must be a boolean.');
			}
		}
		if (this.preferences && this.preferences.notify_backglass_moderation_status) {
			if (!_.isBoolean(this.preferences.notify_backglass_moderation_status)) {
				this.invalidate('preferences.notify_backglass_moderation_status', 'Must be a boolean.');
			}
		}

		// TODO put this into separate validation when this is fixed: https://github.com/LearnBoost/mongoose/issues/1919
		if (this.channel_config && this.channel_config.subscribed_releases) {
			if (!_.isArray(this.channel_config.subscribed_releases)) {
				this.invalidate('channel_config.subscribed_releases', 'Must be an array of release IDs.');
				return;
			}
			let i = 0;
			const Release = mongoose.model('Release');
			return Promise.each(this.channel_config.subscribed_releases, releaseId => {
				return Release.findOne({ id: releaseId }).exec().then(rls => {
					if (!rls) {
						this.invalidate('channel_config.subscribed_releases.' + i, 'Release with ID "' + releaseId + '" does not exist.');
					}
					i++;
				});

			});
		}
		return null;

	}).then(() => true);

}, null);

UserSchema.path('password_hash').validate(function() {
	// here we check the length. remember that the virtual _password field is
	// the one that triggers the hashing.
	if (this._password && _.isString(this._password) && !validator.isLength(this._password, 6)) {
		this.invalidate('password', 'Password must be at least 6 characters.');
	}
}, null);

UserSchema.path('_plan').validate(function(plan) {
	return _.includes(config.vpdb.quota.plans.map(p => p.id), plan);
}, 'Plan must be one of: [' +  config.vpdb.quota.plans.map(p => p.id).join(',') + ']');


//-----------------------------------------------------------------------------
// METHODS
//-----------------------------------------------------------------------------

/**
 * Authenticate - check if the passwords are the same
 *
 * @param {String} plainText
 * @return {Boolean}
 * @api public
 */
UserSchema.methods.authenticate = function(plainText) {
	return this.hashPassword(plainText) === this.password_hash;
};

/**
 * Make salt
 *
 * @return {String}
 * @api public
 */
UserSchema.methods.makeSalt = function() {
	return Math.round((new Date().valueOf() * Math.random())) + '';
};

/**
 * Encrypt password
 *
 * @param {String} password
 * @return {String}
 * @api public
 */
UserSchema.methods.hashPassword = function(password) {
	if (!password) {
		return '';
	}
	if (!this.password_salt) {
		return '';
	}
	return crypto.createHmac('sha1', this.password_salt).update(password).digest('hex');
};

UserSchema.methods.passwordSet = function() {
	return this.password_salt && this.password_hash;
};

UserSchema.methods.hasRole = function(role) {
	if (_.isArray(role)) {
		for (let i = 0; i < role.length; i++) {
			if (this.roles.includes(role[i])) {
				return true;
			}
		}
		return false;

	} else {
		return this.roles.includes(role);
	}
};


//-----------------------------------------------------------------------------
// STATIC METHODS
//-----------------------------------------------------------------------------

UserSchema.statics.createUser = function(userObj, confirmUserEmail) {

	const User = mongoose.model('User');

	let user, count;
	return Promise.try(() => {
		user = new User(_.extend(userObj, {
			created_at: new Date(),
			roles: ['member'],
			_plan: config.vpdb.quota.defaultPlan
		}));

		if (confirmUserEmail) {
			user.email_status = {
				code: 'pending_registration',
				token: randomstring.generate(16),
				expires_at: new Date(new Date().getTime() + 86400000), // 1d valid
				value: userObj.email
			};
		} else {
			user.email_status = { code: 'confirmed' };
			user.is_active = true;
			user.validated_emails = [userObj.email];
		}
		return user.validate();

	}).then(() => {
		return User.count().exec();

	}).then(c => {
		count = c;
		user.roles = count ? [ 'member' ] : [ 'root' ];
		return user.save();

	}).then(u => {
		user = u;
		return require('../common/acl').addUserRoles(user.id, user.roles);

	}).then(() => {
		logger.info('[model|user] %s <%s> successfully created with ID "%s" and plan "%s".', count ? 'User' : 'Root user', user.email, user.id, user._plan);
		return user;
	});
};


/**
 * Tries to merge a bunch of users based on request parameters.
 *
 * @param mergeUsers Merge candidates
 * @param explanation Explanation in case no user ID provided in request
 * @param req Request object
 * @param error Error helper
 * @return Promise<user> Merged user on success, rejects on error
 */
UserSchema.statics.tryMergeUsers = function(mergeUsers, explanation, req, error) {
	if (req.query.merged_user_id) {
		const keepUser = _.find(mergeUsers, u => u.id === req.query.merged_user_id);
		if (keepUser) {
			const otherUsers = mergeUsers.filter(u => u.id !== req.query.merged_user_id);
			logger.info('[model|user] Merging users [ %s ] into %s as per query parameter.', otherUsers.map(u => u.id).join(', '), keepUser.id);
			// merge users
			return Promise
				.each(otherUsers, otherUser => UserSchema.statics.mergeUsers(keepUser, otherUser, explanation, req))
				.then(() => keepUser);
		} else {
			throw error('Provided user ID does not match any of the conflicting users.').status(400);
		}
	} else {
		// otherwise, fail and query merge resolution
		throw error('Conflicted users, must merge.')
			.data({ explanation: explanation, users: mergeUsers.map(u => UserSerializer.detailed(u, req)) })
			.status(409);
	}
};

/**
 * Merges one user into another.
 *
 * @param keepUser User to keep
 * @param mergeUser User to merge into the other and then delete
 * @param explanation Explanation to put into mail, if null no mail is sent.
 * @param req Request object
 * @returns {*|Promise}
 */
UserSchema.statics.mergeUsers = function(keepUser, mergeUser, explanation, req) {

	logger.info('[model|user] Merging %s into %s...', mergeUser.id, keepUser.id);
	if (keepUser.id === mergeUser.id) {
		return Promise.reject('Cannot merge user ' + keepUser.id + ' into itself!');
	}
	let num = 0;

	// 1. update references
	return Promise.all([
		mongoose.model('Backglass').update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() }),
		mongoose.model('Build').update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() }),
		mongoose.model('Comment').update({ _from: mergeUser._id.toString() }, { _from: keepUser._id.toString() }),
		mongoose.model('File').update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() }),
		mongoose.model('Game').update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() }),
		mongoose.model('GameRequest').update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() }),
		mongoose.model('LogEvent').update({ _actor: mergeUser._id.toString() }, { _actor: keepUser._id.toString() }),
		mongoose.model('LogEvent').update({ '_ref.user': mergeUser._id.toString() }, { '_ref.user': keepUser._id.toString() }),
		mongoose.model('LogUser').update({ _user: mergeUser._id.toString() }, { _user: keepUser._id.toString() }),
		mongoose.model('LogUser').update({ _actor: mergeUser._id.toString() }, { _actor: keepUser._id.toString() }),
		mongoose.model('Medium').update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() }),
		mongoose.model('Release').update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() }),
		mongoose.model('Rom').update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() }),
		mongoose.model('Tag').update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() }),
		mongoose.model('Token').update({ _created_by: mergeUser._id.toString() }, { _created_by: keepUser._id.toString() }),

	]).then(result => {

		const strs = [ '%s backglass(es)', '%s build(s)', '%s comment(s)', '%s file(s)', '%s game(s)', '%s game request(s)',
			'%s log event(s) as actor', '%s log events as ref', '%s user log(s) as user', '%s user log(s) as actor',
			'%s media', '%s release(s)', '%s rom(s)', '%s tag(s)', '%s token(s).'];
		logger.info('[model|user] Merged %s', result.map((r, i) => _.assign(r, { str: strs[i].replace('%s', r.n) })).filter(r => r.n > 0).map(r => r.str).join(', '));

		// 1.1 update release versions

		return mongoose.model('Release').find({ 'authors._user': mergeUser._id.toString() }).exec().then(releases => {
			return Promise.all(releases.map(release => {
				release.authors.forEach(author => {
					if (author._user.equals(mergeUser._id)) {
						author._user = keepUser._id;
						num++;
					}
				});
				return release.save();
			}));

		}).then(() => mongoose.model('Release').find({ 'versions.files.validation._validated_by': mergeUser._id.toString() }).exec().then(releases => {

			logger.info('[model|user] Merged %s author(s)', num);
			num = 0;

			// 1.2 update release validation
			return Promise.all(releases.map(release => {
				release.versions.forEach(releaseVersion => {
					releaseVersion.files.forEach(releaseFile => {
						if (releaseFile.validation._validated_by.equals(mergeUser._id)) {
							releaseFile.validation._validated_by = keepUser._id;
							num++;
						}
					});
				});
				return release.save();
			}));

		})).then(() => mongoose.model('Release').find({ 'moderation.history._created_by': mergeUser._id.toString() }).exec().then(releases => {

			logger.info('[model|user] Merged %s release moderation(s)', num);
			num = 0;

			// 1.3 release moderation
			return Promise.all(releases.map(release => {
				release.moderation.history.forEach(historyItem => {
					if (historyItem._created_by.equals(mergeUser._id)) {
						historyItem._created_by = keepUser._id;
						num++;
					}
				});
				return release.save();
			}));

		})).then(() => mongoose.model('Backglass').find({ 'moderation.history._created_by': mergeUser._id.toString() }).exec().then(backglasses => {

			logger.info('[model|user] Merged %s item(s) in release moderation history', num);
			num = 0;

			// 1.4 backglass moderation
			return Promise.all(backglasses.map(backglass => {
				backglass.moderation.history.forEach(historyItem => {
					if (historyItem._created_by.equals(mergeUser._id)) {
						historyItem._created_by = keepUser._id;
						num++;
					}
				});
				return backglass.save();
			}));
		}));

	}).then(() => {

		logger.info('[model|user] Merged %s item(s) in backglass moderation history', num);
		num = 0;

		// 1.5 ratings. first, update user id of all ratings
		return mongoose.model('Rating').update({ _from: mergeUser._id.toString() }, { _from: keepUser._id.toString() }).then(result => {

			logger.info('[model|user] Merged %s rating(s)', result.n);

			// then, remove duplicate ratings
			const map = new Map();
			return mongoose.model('Rating').find({ _from: mergeUser._id.toString() }).exec().then(ratings => {
				// put ratings for the same thing into a map
				ratings.forEach(rating => {
					const key = _.keys(rating._ref).sort().join(',') + ':' + _.values(rating._ref).sort().join(',');
					map.set(key, (map.get(key) || []).push(rating));
				});
				// remove dupes
				const queries = [];
				Array.from(map.values()).filter(ratings => ratings.length > 1).forEach(dupeRatings => {
					// update first
					const first = dupeRatings.shift();
					queries.push(first.update({ value: Math.round(_.sum(dupeRatings.map(r => r.value)) / dupeRatings.length) }));
					// delete the rest
					dupeRatings.forEach(r => queries.push(r.remove()));
				});
				return Promise.all(queries);
			});
		});

	}).then(() => {

		// 1.6 stars: first, update user id of all stars
		return mongoose.model('Star').update({ _from: mergeUser._id.toString() }, { _from: keepUser._id.toString() }).then(result => {

			logger.info('[model|user] Merged %s star(s)', result.n);

			// then, remove duplicate stars
			const map = new Map();
			return mongoose.model('Star').find({ _from: mergeUser._id.toString() }).exec().then(stars => {
				// put ratings for the same thing into a map
				stars.forEach(star => {
					const key = _.keys(star._ref).sort().join(',') + ':' + _.values(star._ref).sort().join(',');
					map.set(key, (map.get(key) || []).push(star));
				});
				// remove dupes
				const queries = [];
				Array.from(map.values()).filter(ratings => ratings.length > 1).forEach(dupeStars => {
					// keep first
					dupeStars.shift();
					// delete the rest
					dupeStars.forEach(r => queries.push(r.remove()));
				});
				return Promise.all(queries);
			});
		});

	}).then(() => {

		// 2. merge data
		config.vpdb.quota.plans.forEach(plan => { // we assume that in the settings, the plans are sorted by increasing value
			if ([keepUser._plan, mergeUser._plan].includes(plan.id)) {
				keepUser._plan = plan.id;
			}
		});
		keepUser.is_active = keepUser.is_active && mergeUser.is_active; // both must be active to stay active
		keepUser.emails = _.uniq([...keepUser.emails, ...mergeUser.emails]);
		keepUser.roles = _.uniq([...keepUser.roles, ...mergeUser.roles]);
		if (mergeUser.password_hash && !keepUser.password_hash) {
			keepUser.password_hash = mergeUser.password_hash;
			keepUser.password_salt = mergeUser.password_salt;
		}
		if (mergeUser.location && !keepUser.location) {
			keepUser.location = mergeUser.location;
		}
		keepUser.credits = (keepUser.credits || 0) + (mergeUser.credits || 0);
		keepUser.counter.comments = keepUser.counter.comments + mergeUser.counter.comments;
		keepUser.counter.downloads = keepUser.counter.downloads + mergeUser.counter.downloads;
		keepUser.counter.stars = keepUser.counter.stars + mergeUser.counter.stars;
		keepUser.validated_emails = _.uniq([...keepUser.validated_emails, ...mergeUser.validated_emails]);


		if (mergeUser.providers) {
			if (!keepUser.providers) {
				keepUser.providers = {};
			}
			_.keys(mergeUser.providers).forEach(k => {
				if (!keepUser.providers[k]) {
					keepUser.providers[k] = mergeUser.providers[k];
				}
			});
		}
		return keepUser.save();

	}).then(() => {

		// 3. log
		mongoose.model('LogUser').success(req, keepUser, 'merge_users', { kept: keepUser, merged: mergeUser });

		// 4. notify
		if (explanation) {
			return mailer.userMergedDeleted(keepUser, mergeUser, explanation)
				.then(() => mailer.userMergedKept(keepUser, mergeUser, explanation));
		}
		return null;

	}).then(() => {

		logger.info('[model|user] Done merging, removing merged user %s.', mergeUser.id);

		// 5. delete merged user
		return mergeUser.remove();

	}).then(() => keepUser);
};

//-----------------------------------------------------------------------------
// TRIGGERS
//-----------------------------------------------------------------------------
UserSchema.post('remove', function(obj, done) {

	const acl = require('../common/acl');
	const LogUser = mongoose.model('LogUser');
	const Token = mongoose.model('Token');
	return Promise
		.try(() => LogUser.remove({ _user: obj._id }))
		.then(() => Token.remove({ _created_by: obj._id }))
		.then(() => acl.removeUserRoles(obj.id, obj.roles))
		.nodeify(done);
});


//-----------------------------------------------------------------------------
// OPTIONS
//-----------------------------------------------------------------------------
UserSchema.options.toObject = { virtuals: true, versionKey: false };

module.exports = mongoose.model('User', UserSchema);
