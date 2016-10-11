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

"use strict";

var _ = require('lodash');
var util = require('util');
var logger = require('winston');

var Game = require('mongoose').model('Game');
var Release = require('mongoose').model('Release');
var Comment = require('mongoose').model('Comment');
var LogEvent = require('mongoose').model('LogEvent');
var api = require('./api');
var acl = require('../../acl');

var error = require('../../modules/error')('api', 'comment');
var mailer = require('../../modules/mailer');

exports.createForRelease = function(req, res) {

	let comment, release;
	Promise.try(() => {
		return Release.findOne({ id: req.params.id })
			.populate('_game')
			.populate('_created_by')
			.exec();

	}).then(r => {
		release = r;
		if (!release) {
			throw error('No such release with ID "%s"', req.params.id).status(404);
		}
		if (release._game.isRestricted('release')) {
			throw error('No such release with ID "%s"', req.params.id).status(404);
		}
		comment = new Comment({
			_from: req.user._id,
			_ref: { release: release },
			message: req.body.message,
			ip: req.ip || req.headers[ 'x-forwarded-for' ] || req.connection.remoteAddress || '0.0.0.0',
			created_at: new Date()
		});
		return comment.validate();

	}).then(() => {
		return comment.save();

	}).then(() => {
		logger.info('[api|comment:create] User <%s> commented on release "%s" (%s).', req.user.email, release.id, release.name);

		let updates = [];
		updates.push(release.incrementCounter('comments'));
		updates.push(release.populate('_game').execPopulate().then(release._game.incrementCounter('comments')));
		updates.push(req.user.incrementCounter('comments'));
		updates.push(new Promise((resolve, reject) => {
			LogEvent.log(req, 'create_comment', true, { comment: comment.toSimple() }, {
				game: release._game._id,
				release: release._id
			}, err => {
				if (err) {
					return reject(err);
				}
				resolve(err);
			});
		}));
		return Promise.all(updates);

	}).then(() => {
		return Comment.findById(comment._id).populate('_from').exec();

	}).then(comment => {

		api.success(res, comment.toSimple(), 201);

		// notify release creator (only if not the same user)
		if (release._created_by.id !== req.user.id) {
			mailer.releaseCommented(release._created_by, req.user, release._game, release, req.body.message);
		}

	}).catch(api.handleError(res, error, 'Error saving comment'));
};

exports.createForReleaseModeration = function(req, res) {

	let comment, release;
	Promise.try(() => {
		return Release.findOne({ id: req.params.id })
			.populate('_game')
			.populate('_created_by')
			.exec();

	}).then(r => {
		release = r;
		if (!release) {
			throw error('No such release with ID "%s"', req.params.id).status(404);
		}

		// must be owner of release or moderator
		if (req.user.id === release._created_by.id) {
			return true;
		} else {
			return acl.isAllowed(req.user.id, 'releases', 'moderate');
		}

	}).then(isAllowed => {
		if (!isAllowed) {
			throw error('Access denied, must be either moderator or owner of release.').status(403);
		}
		comment = new Comment({
			_from: req.user._id,
			_ref: { release_moderation: release },
			message: req.body.message,
			ip: req.ip || req.headers[ 'x-forwarded-for' ] || req.connection.remoteAddress || '0.0.0.0',
			created_at: new Date()
		});
		return comment.save();

	}).then(() => {
		logger.info('[api|comment:create] User <%s> commented on release moderation "%s" (%s).', req.user.email, release.id, release.name);
		return Comment.findById(comment._id).populate('_from').exec();

	}).then(comment => {
		api.success(res, comment.toSimple(), 201);

		// notify
		if (release._created_by.id === req.user.id) {
			// notify moderator(s)
			Comment.find({ '_ref.release_moderation': release._id, _from: { $ne: release._created_by._id } })
				.populate('_from')
				.exec()
				.then(comments => {
					comments.forEach(comment => {
						mailer.releaseModerationCommented(comment._from, req.user, release._game, release, 'Uploader', req.body.message);
					});
				});
		} else {
			// notify uploader
			mailer.releaseModerationCommented(release._created_by, req.user, release._game, release, 'Moderator', req.body.message);
		}

	}).catch(api.handleError(res, error, 'Error saving comment'));
};

exports.listForRelease = function(req, res) {

	let pagination = api.pagination(req, 10, 50);
	let release;
	Promise.try(() => {
		return Release.findOne({ id: req.params.id })
			.populate('_game')
			.populate('_created_by')
			.exec();

	}).then(r => {
		release = r;
		if (!release) {
			throw error('No such release with ID "%s"', req.params.id).status(404);
		}
		return Release.hasRestrictionAccess(req, release._game, release);

	}).then(hasAccess => {
		if (!hasAccess) {
			throw error('No such release with ID "%s"', req.params.id).status(404);
		}
		return Comment.paginate({ '_ref.release': release._id }, {
			page: pagination.page,
			limit: pagination.perPage,
			populate: [ '_from' ],
			sort: { created_at: -1 }
		}).then(result => [result.docs, result.total]);

	}).spread((results, count) => {

		let comments = results.map(comment => comment.toSimple());
		api.success(res, comments, 200, api.paginationOpts(pagination, count));

	}).catch(api.handleError(res, error, 'Error listing comments for rleease.'));
};

exports.listForReleaseModeration = function(req, res) {

	let release;
	Promise.try(() => {
		return Release.findOne({ id: req.params.id }).populate('_created_by').exec();

	}).then(r => {
		release = r;
		if (!release) {
			throw error('No such release with ID "%s"', req.params.id).status(404);
		}
		// must be owner of release or moderator
		if (req.user.id === release._created_by.id) {
			return true;
		} else {
			return acl.isAllowed(req.user.id, 'releases', 'moderate');
		}

	}).then(isAllowed => {
		if (!isAllowed) {
			throw error('Access denied, must be either moderator or owner of release.').status(403);
		}
		return Comment.find({ '_ref.release_moderation': release._id })
			.populate('_from')
			.exec();

	}).then(comments => {
		comments.sort((c1, c2) => c1.created_at.getTime() - c2.created_at.getTime());
		api.success(res, _.map(comments, comment => comment.toSimple()), 200);

	}).catch(api.handleError(res, error, 'Error listing moderation comments'));
};
