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

var error = require('../../modules/error')('api', 'comment');

exports.createForRelease = function(req, res) {

	let comment, release;
	Promise.try(() => {
		return Release.findOne({ id: req.params.id }).populate('_game').exec();

	}).then(r => {
		release = r;
		if (!release) {
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
		return api.success(res, comment.toSimple(), 201);

	}).catch(api.handleError(res, error, 'Error saving comment'));
};

exports.listForRelease = function(req, res) {

	var assert = api.assert(error, 'list', '', res);
	var pagination = api.pagination(req, 10, 50);

	Release.findOne({ id: req.params.id }, assert(function(release) {
		if (!release) {
			return api.fail(res, error('No such release with ID "%s"', req.params.id), 404);
		}

		Comment.paginate({ '_ref.release': release._id }, {
			page: pagination.page,
			limit: pagination.perPage,
			populate: [ '_from' ],
			sort: { created_at: -1 }

		}, function(err, result) {
			/* istanbul ignore if  */
			if (err) {
				return api.fail(res, error(err, 'Error listing comments').log('list'), 500);
			}
			var comments = _.map(result.docs, function(comment) {
				return comment.toSimple();
			});
			api.success(res, comments, 200, api.paginationOpts(pagination, result.total));
		});

	}, 'Error finding release in order to list comments.'));
};
