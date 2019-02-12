/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2019 freezy <freezy@vpdb.io>
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

const uniq = require('lodash').uniq;
const mongoose = require('mongoose');
const User = mongoose.model('User');
const LogUser = mongoose.model('LogUser');
const config = require('../../app/common/settings').current;

/**
 * This moves the provider data for every user into a `providers` property
 * and normalizes common attributes.
 *
 * Before:
 * {
 *   provider: 'github',
 *   github: {
 *      id: 1234,
 *      login: 'bleh',
 *      all_other_props_from_github
 *   },
 *   google: {
 *      id: 'abcd',
 *      displayName: 'mooh',
 *      different_props_from_google
 *   }
 * }
 *
 * After:
 * {
 *    is_local: true,
 *    providers: {
 *       github: {
 *          id: '1234',
 *          name: 'bleh',
 *          emails: [ ... ],
 *          created_at: Date,
 *          modified_at: Date,
 *          profile: all_other_props_from_github
 *       },
 *       google: {
 *          id: 'abcd',
 *          name: 'mooh',
 *          emails: [ ... ],
 *          created_at: Date,
 *          modified_at: Date,
 *          profile: different_props_from_google
 *       }
 *    }
 * }
 *
 * Note also that `provider` is gone in favor or `is_local` and the provider ID is
 * always a string.
 */
module.exports.up = async function() {

	const users = await User.find({}).exec();
	const userDb = mongoose.connection.db.collection('users');
	const ipsIds = uniq([ ...config.vpdb.passport.ipboard.map(ips => ips.id), 'gameex', 'vpu' ]);
	console.log('Got %s users, migrating provider data.', users.length);
	for (let i = 0; i < users.length; i++) {
		const user = users[i];
		const changes = { $unset: {}, $set: { providers: {} } };
		let createdAt, modifiedAt;

		// don't need `provider` no more
		changes.$unset.provider = 1;
		changes.$set.is_local = !!user.password_hash;

		// provider data fields
		if (user._doc.github) {
			createdAt = await findCreationDate(user, 'github');
			modifiedAt = await findModificationDate(user, 'github');
			changes.$set.providers.github = {
				id: String(user._doc.github.id),
				name: user._doc.github.login,
				emails: [user._doc.github.email],
				created_at: createdAt,
				modified_at: modifiedAt || createdAt,
				profile: user._doc.github
			};
			changes.$unset.github = 1;
		}
		if (user._doc.google) {
			createdAt = await findCreationDate(user, 'google');
			modifiedAt = await findModificationDate(user, 'google');
			changes.$set.providers.google = {
				id: String(user._doc.google.id),
				name: user._doc.google.displayName
					|| (user._doc.google.name ? user._doc.google.name.givenName || user._doc.google.name.familyName : '')
					|| (user._doc.google.emails && user._doc.google.emails.length ? user._doc.google.emails[0].value.substr(0, user._doc.google.emails[0].value.indexOf('@')) : ''),
				emails: user._doc.google.emails.map(e => e.value),
				created_at: createdAt,
				modified_at: modifiedAt || createdAt,
				profile: user._doc.google
			};
			changes.$unset.google = 1;
		}
		for (let j = 0; j < ipsIds.length; j++) {
			const p = ipsIds[j];
			if (user._doc[p]) {
				createdAt = await findCreationDate(user, p);
				modifiedAt = await findModificationDate(user, p);
				changes.$set.providers[p] = {
					id: String(user._doc[p].id),
					name: user._doc[p].username || user._doc[p].displayName,
					emails: [user._doc[p].email],
					created_at: createdAt,
					modified_at: modifiedAt || createdAt,
					profile: user._doc[p]
				};
				changes.$unset[p] = 1;
			}
		}
		//console.log('%s %s', user.id, require('util').inspect(changes, { colors:true, depth:null}));
		await userDb.updateOne({ id: user.id }, changes);
	}
	console.log('Updated %s users.', users.length);
	return null;
};

async function findCreationDate(user, provider) {
	const log = await LogUser.findOne({
		_user: user._id,
		event: 'registration',
		'payload.provider': provider,
		result: 'success'
	}).exec();
	return log ? log.logged_at : new Date();

}

async function findModificationDate(user, provider) {
	const log = await LogUser.findOne({
		_user: user._id,
		'payload.provider': provider,
		result: 'success'
	}).sort({ logged_at: -1 }).exec();
	return log ? log.logged_at : undefined;
}