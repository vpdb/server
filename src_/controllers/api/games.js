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
const fs = require('fs');
const util = require('util');
const logger = require('winston');
const generate = require('project-name-generator');

const Game = require('mongoose').model('Game');
const GameRequest = require('mongoose').model('GameRequest');
const Release = require('mongoose').model('Release');
const Star = require('mongoose').model('Star');
const Rom = require('mongoose').model('Rom');
const LogEvent = require('mongoose').model('LogEvent');
const Backglass = require('mongoose').model('Backglass');
const Medium = require('mongoose').model('Medium');

const GameSerializer = require('../../serializers/game.serializer');
const GameRequestSerializer = require('../../serializers/game_request.serializer');
const ReleaseSerializer = require('../../serializers/release.serializer');
const BackglassSerializer = require('../../serializers/backglass.serializer');
const MediumSerializer = require('../../serializers/medium.serializer');

const api = require('./api');

const acl = require('../../../src/common/acl');
const fileModule = require('../../modules/file');
const mailer = require('../../../src/common/mailer');
const error = require('../../modules/error')('api', 'game');
const config = require('../../../src/common/settings').current;



/**
 * Returns either 200 or 404. Useful for checking if a given game ID already exists.
 * @param {Request} req
 * @param {Response} res
 */
exports.head = function(req, res) {

	return Promise.try(() => {
		// retrieve game
		return Game.findOne({ id: req.params.id }).exec();

	}).then(game => {
		res.set('Content-Length', 0);
		return res.status(game ? 200 : 404).end();

	}).catch(api.handleError(res, error, 'Error retrieving game'));
};


/**
 * Creates a new game.
 * @param {Request} req
 * @param {Response} res
 */
exports.create = function(req, res) {

	let game;
	return Promise.try(() => {
		return Game.getInstance(_.assign(req.body, {
			_created_by: req.user._id,
			created_at: new Date()
		}));

	}).then(newGame => {
		game = newGame;
		logger.info('[api|game:create] %s', util.inspect(req.body));
		return newGame.validate();

	}).then(() => {
		logger.info('[api|game:create] Validations passed.');
		return game.save();

	}).then(() => {
		logger.info('[api|game:create] Game "%s" created.', game.title);
		return game.activateFiles();

	}).then(() => {
		// link roms if available
		if (game.ipdb && game.ipdb.number) {
			return Rom.find({ _ipdb_number: game.ipdb.number }).exec().then(roms => {
				logger.info('[api|game:create] Linking %d ROMs to created game %s.', roms.length, game._id);
				return Promise.each(roms, rom => {
					rom._game = game._id.toString();
					return rom.save();
				});
			});
		}
		return null;

	}).then(() => {
		// find game request
		return Promise.try(() => {
			if (req.body._game_request) {
				return GameRequest
					.findOne({ id: req.body._game_request })
					.populate('_created_by')
					.exec();

			} else if (game.ipdb && game.ipdb.number) {
				return GameRequest
					.findOne({ ipdb_number: parseInt(game.ipdb.number) })
					.populate('_created_by')
					.exec();
			}
			return null;

		}).then(gameRequest => {
			if (gameRequest) {
				mailer.gameRequestProcessed(gameRequest._created_by, game);
				gameRequest.is_closed = true;
				gameRequest._game = game._id;
				return gameRequest.save();
			}
			return null;

		}).then(gameRequest => {
			if (gameRequest) {
				LogEvent.log(req, 'update_game_request', false, {
					game_request: _.pick(GameRequestSerializer.simple(gameRequest, req), [ 'id', 'title', 'ipdb_number', 'ipdb_title' ]),
					game: GameSerializer.reduced(game, req)
				}, {
					game: game._id,
					game_request: gameRequest._id
				});
			}
			return null;
		});

	}).then(() => {
		// copy backglass and logo to media
		return Promise.all([
			exports._copyMedia(req.user, game, game._backglass, 'backglass_image', bg => bg.metadata.size.width * bg.metadata.size.height > 647000),  // > 900x720
			exports._copyMedia(req.user, game, game._logo, 'wheel_image')

		]).catch(err => {
			logger.error('[api|game:create] Error while copying media: %s', err.message);
			logger.error(err);
		});

	}).then(() => {
		LogEvent.log(req, 'create_game', true, { game: _.omit(GameSerializer.simple(game, req), [ 'rating', 'counter' ]) }, { game: game._id });
		return api.success(res, GameSerializer.detailed(game, req), 201);

	}).catch(api.handleError(res, error, 'Error creating game'));
};


/**
 * Updates an existing game.
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.update = function(req, res) {

	const updateableFields = [ 'title', 'year', 'manufacturer', 'game_type', 'short', 'description', 'instructions',
		'produced_units', 'model_number', 'themes', 'designers', 'artists', 'features', 'notes', 'toys', 'slogans',
		'ipdb', 'number', '_backglass', '_logo', 'keywords' ];

	let body = _.cloneDeep(req.body);
	let game, oldGame, oldMediaObj, oldMedia, newMedia;
	return Promise.try(() => {
		return Game.findOne({ id: req.params.id })
			.populate({ path: '_backglass' })
			.populate({ path: '_logo' })
			.exec();

	}).then(game => {
		if (!game) {
			throw error('No such game with ID "%s".', req.params.id).status(404);
		}
		oldGame = _.cloneDeep(game);

		// fail if invalid fields provided
		const submittedFields = _.keys(req.body);
		if (_.intersection(updateableFields, submittedFields).length !== submittedFields.length) {
			let invalidFields = _.difference(submittedFields, updateableFields);
			throw error('Invalid field%s: ["%s"]. Allowed fields: ["%s"]', invalidFields.length === 1 ? '' : 's', invalidFields.join('", "'), updateableFields.join('", "')).status(400).log('update');
		}

		oldMediaObj = {
			backglass: game._backglass,
			logo: game._logo
		};
		oldMedia = {
			_backglass: game._backglass.id,
			_logo: game._logo ? game._logo.id : null
		};
		newMedia = {
			_backglass: req.body._backglass || oldMedia._backglass,
			_logo: req.body._logo || oldMedia._logo,
		};

		// copy media if not submitted so it doesn't get erased
		req.body._backglass = newMedia._backglass;
		req.body._logo = newMedia._logo;

		// apply changes
		return game.updateInstance(req.body);

	}).then(g => {
		game = g;

		// validate and save
		return game.validate().then(() => game.save());

	}).then(() => {
		logger.info('[api|game:update] Game "%s" updated.', game.title);
		return game.activateFiles();

	}).then(activatedFileIds => {
		logger.info('[api|game:update] Activated %s new file%s.', activatedFileIds.length, activatedFileIds.length === 1 ? '' : 's');

		// copy to media and delete old media if changed
		let mediaCopies = [];
		if (oldMedia._backglass !== newMedia._backglass) {
			mediaCopies.push(exports._copyMedia(req.user, game, game._backglass, 'backglass_image', bg => bg.metadata.size.width * bg.metadata.size.height > 647000));  // > 900x720
			mediaCopies.push(oldMediaObj.backglass.remove());
		}
		if (oldMedia._logo !== newMedia._logo) {
			mediaCopies.push(exports._copyMedia(req.user, game, game._logo, 'wheel_image'));
			if (oldMediaObj.logo) {
				mediaCopies.push(oldMediaObj.logo.remove());
			}
		}
		return Promise.all(mediaCopies).catch(err => {
			logger.error('[api|game:update] Error while copying and cleaning media: %s', err.message);
			logger.error(err);
		});

	}).then(() => {

		LogEvent.log(req, 'update_game', false, LogEvent.diff(oldGame, body), { game: game._id });
		return api.success(res, GameSerializer.detailed(game, req), 200);

	}).catch(api.handleError(res, error, 'Error updating game'));
};


/**
 * Deletes a game.
 * @param {Request} req
 * @param {Response} res
 */
exports.del = function(req, res) {

	let game;
	return Promise.try(() => {
		return Game.findOne({ id: req.params.id })
			.populate({ path: '_backglass' })
			.populate({ path: '_logo' })
			.exec();

	}).then(g => {
		game = g;
		if (!game) {
			throw error('No such game with ID "%s".', req.params.id).status(404);
		}

		// check for release and backglass reference and fail if there are
		let refs = { releases: 0, backglasses: 0 };
		return Promise.all([
			[ Release, '_game', 'releases' ],
			[ Backglass, '_game', 'backglasses' ]
		].map(([ Model, ref, key ]) => {
			return Model.find({ [ref]: game._id }).exec().then(items => {
				if (_.isEmpty(items)) {
					return;
				}
				refs[key] = items.length;
			});

		})).then(() => {
			if (_.sum(_.values(refs)) > 0) {
				throw error('Cannot delete game because it is referenced by %s.', Object.keys(refs).map(f => `${refs[f]} ${f}`).join(' and '))
					.status(400).warn('delete');
			}
			return game.remove();
		});

	}).then(() => {
		logger.info('[api|game:delete] Game "%s" (%s) successfully deleted.', game.title, game.id);

		// log event
		LogEvent.log(req, 'delete_game', false, { game: _.omit(GameSerializer.simple(game, req), [ 'rating', 'counter' ]) }, { game: game._id });

		return api.success(res, null, 204);

	}).catch(api.handleError(res, error, 'Error deleting game'));
};


/**
 * Lists all games.
 * @param {Request} req
 * @param {Response} res
 */
exports.list = function(req, res) {

	let pagination = api.pagination(req, 12, 60);
	let query = [];

	return Promise.try(() => {

		// text search
		if (req.query.q) {
			if (req.query.q.trim().length < 2) {
				throw error('Query must contain at least two characters.').status(400);
			}
			// sanitize and build regex
			let titleQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, '');
			let titleRegex = new RegExp(titleQuery.split('').join('.*?'), 'i');
			let idQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, ''); // TODO tune
			query.push({ $or: [{ title: titleRegex }, { id: idQuery }] });
		}

		// filter by manufacturer
		if (req.query.mfg) {
			let mfgs = req.query.mfg.split(',');
			query.push({ manufacturer: mfgs.length === 1 ? mfgs[0] : { $in: mfgs } });
		}

		// filter by decade
		if (req.query.decade) {
			let decades = req.query.decade.split(',');
			let d = [];
			decades.forEach(function(decade) {
				d.push({ year: { $gte: parseInt(decade, 10), $lt: parseInt(decade, 10) + 10 } });
			});
			if (d.length === 1) {
				query.push(d[0]);
			} else {
				query.push({ $or: d });
			}
		}

		/*
		 * If min_releases is set, only list where's actually content (by content we mean "releases"):
		 *   - if logged as moderator, just query counter.releases
		 *   - if not logged, retrieve restricted game IDs and exclude them
		 *   - if member, retrieve restricted game IDs, retrieve authored/created game IDs and exclude difference
		 *
		 * Note that this a quick fix and doesn't work for min_releases > 1, though this use case isn't very useful.
		 */
		const minReleases = parseInt(req.query.min_releases);
		if (minReleases) {

			// counter includes restricted releases
			query.push({ 'counter.releases': { $gte: minReleases } });

			// check if additional conditions are needed
			return Promise.try(() => {
				return req.user ? acl.isAllowed(req.user.id, 'releases', 'view-restriced') : false;

			}).then(isModerator => {

				// moderator gets unfiltered list
				if (isModerator) {
					return;
				}

				// user gets owned/authored releases
				if (req.user) {
					return Release.find({ $or: [ { _created_by: req.user._id }, { 'authors._user': req.user._id }] }).exec().then(releases => {
						query.push({ $or: [
							{ 'ipdb.mpu': { $nin: config.vpdb.restrictions.release.denyMpu } },
							{ _id: { $in: releases.map(r => r._game) } }
						] });
					});
				}

				// just exclude all restricted games for anon
				query.push({ 'ipdb.mpu': { $nin: config.vpdb.restrictions.release.denyMpu } });
				return null;
			});
		}
		return null;

	}).then(() => {

		let sort = api.sortParams(req, { title: 1 }, {
			popularity: '-metrics.popularity',
			rating: '-rating.score',
			title: 'title_sortable'
		});

		let q = api.searchQuery(query);
		logger.info('[api|game:list] query: %s, sort: %j', util.inspect(q, { depth: null }), util.inspect(sort));

		return Game.paginate(q, {
			page: pagination.page,
			limit: pagination.perPage,
			populate: ['_backglass', '_logo'],
			sort: sort
		}).then(result => [result.docs, result.total]);

	}).spread((results, count) => {

		let games = results.map(game => GameSerializer.simple(game, req));
		return api.success(res, games, 200, api.paginationOpts(pagination, count));

	}).catch(api.handleError(res, error, 'Error listing games'));
};


/**
 * Lists a game of a given game ID.
 * @param {Request} req
 * @param {Response} res
 */
exports.view = function(req, res) {

	let game, result;
	return Promise.try(() => {
		// retrieve game
		return Game.findOne({ id: req.params.id })
			.populate({ path: '_backglass' })
			.populate({ path: '_logo' })
			.exec();

	}).then(g => {
		game = g;
		if (!game) {
			throw error('No such game with ID "%s"', req.params.id).status(404);
		}
		result = GameSerializer.detailed(game, req);
		return game.incrementCounter('views');

	}).then(() => {

		// retrieve linked releases
		let opts = {};
		return Release.restrictedQuery(req, game, { _game: game._id }).then(rlsQuery => {

			if (!rlsQuery) {
				return [];
			}

			return Promise.try(() => {

				// retrieve stars if logged
				if (!req.user) {
					return null;
				}
				return Star
					.find({ type: 'release', _from: req.user._id }, '_ref.release')
					.exec()
					.then(stars => stars.map(star => star._ref.release.id.toString()));

			}).then(starredReleaseIds => {
				opts.starredReleaseIds = starredReleaseIds;
				return Release.find(Release.approvedQuery(rlsQuery))
					.populate({ path: '_tags' })
					.populate({ path: '_created_by' })
					.populate({ path: 'authors._user' })
					.populate({ path: 'versions.files._file' })
					.populate({ path: 'versions.files._playfield_image' })
					.populate({ path: 'versions.files._playfield_video' })
					.populate({ path: 'versions.files._compatibility' })
					.exec();
			});

		}).then(releases => {
			opts.excludedFields = [ 'game' ];
			result.releases = releases.map(release => ReleaseSerializer.detailed(release, req, opts));
			return null;
		});

	}).then(() => {

		// retrieve linked backglasses
		return Backglass.restrictedQuery(req, game, { _game: game._id }).then(backglassQuery => {

			//logger.info('BACKGLASS query: %s', util.inspect(backglassQuery, { depth: null }));

			if (!backglassQuery) {
				return [];
			}
			return Backglass.find(Backglass.approvedQuery(backglassQuery))
				.populate({ path: 'authors._user' })
				.populate({ path: 'versions._file' })
				.populate({ path: '_created_by' })
				.exec();

		}).then(backglasses => {
			result.backglasses = backglasses.map(backglass => BackglassSerializer.simple(backglass, req, { excludedFields: [ 'game' ] }));
			return null;
		});

	}).then(() => {
		return Medium.find({ '_ref.game': game._id })
			.populate({ path: '_file' })
			.populate({ path: '_created_by' })
			.exec();

	}).then(media => {
		result.media = media.map(medium => MediumSerializer.simple(medium, req), { excludedFields: ['game'] });

		return api.success(res, result, 200);

	}).catch(api.handleError(res, error, 'Error viewing game'));
};

/**
 * Returns a random name for release name inspiration
 *
 * @param {Request} req
 * @param {Response} res
 */
exports.releaseName = function(req, res) {

	let game;
	return Promise.try(() => {
		return Game.findOne({ id: req.params.id }).exec();

	}).then(g => {
		game = g;
		if (!game) {
			throw error('No such game with ID "%s".', req.params.id).status(404);
		}
		let words = generate().raw;
		if (!_.isEmpty(game.keywords)) {
			words.splice(words.length - 1);
			words.push(game.keywords[Math.floor(Math.random() * game.keywords.length)]);
		}
		words.push('edition');
		return api.success(res, { name:words.map(w => w.toLowerCase()).map(_.upperFirst).join(' ') }, 200);

	}).catch(api.handleError(res, error, 'Error generating release name'));
};

/**
 * Copies a given file to a given media type.
 *
 * @param {User} user Creator of the media
 * @param {Game} game Game the media will be linked to
 * @param {File} file File to be copied
 * @param {string} category Media category
 * @param {function} [check] Function called with file parameter. Media gets discarded if false is returned.
 */
exports._copyMedia = function(user, game, file, category, check) {
	return Promise.try(() => {

		check = check || (() => true);
		if (file && check(file)) {

			const fieldsToCopy = [ 'name', 'bytes', 'created_at', 'mime_type', 'file_type' ];
			const fileToCopy = _.assign(_.pick(file, fieldsToCopy), {
				_created_by: user,
				variations: {}
			});
			return fileModule.create(fileToCopy, fs.createReadStream(file.getPath()), error).then(copiedFile => {
				logger.info('[api|game:create] Copied file "%s" to "%s".', file.id, copiedFile.id);
				const medium = new Medium({
					_file: copiedFile._id,
					_ref: { game: game._id },
					category: category,
					created_at: new Date(),
					_created_by: user
				});
				return medium.save();

			}).then(medium => {
				logger.info('[api|game:create] Copied %s as media to %s.', category, medium.id);
				return medium.activateFiles();
			});
		}
		return null;
	});
};