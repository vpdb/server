"use strict";

var _ = require('underscore');
var util = require('util');
var async = require('async');
var logger = require('winston');

var Game = require('mongoose').model('Game');
var api = require('./api');

var storage = require('../../modules/storage');


/**
 * Returns either 200 or 404. Useful for checking if a given game ID already exists.
 * @param req Request object
 * @param res Response object
 */
exports.head = function(req, res) {

	Game.findOne({ id: req.params.id }, function(err, game) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[api|game:head] Error finding game "%s": %s', req.params.id, err, {});
			return api.fail(res, err, 500);
		}
		res.set('Content-Length', 0);
		return res.status(game ? 200 : 404).end();
	});
};


/**
 * Creates a new game.
 * @param req Request object
 * @param res Response object
 */
exports.create = function(req, res) {

	Game.getInstance(_.extend(req.body, {
		_created_by: req.user._id,
		created_at: new Date()
	}), function(err, newGame) {
		if (err) {
			logger.error('[api|game:create] Error creating game instance: %s', err, {});
			return api.fail(res, err, 500);
		}
		var ok = api.ok('game', 'create', newGame.id, res);
		var okk = api.ok('game', 'create', newGame.id, res, function(done) {
			newGame.remove(done);
		});
		logger.info('[api|game:create] %s', util.inspect(req.body));
		newGame.validate(function(err) {
			if (err) {
				logger.warn('[api|game:create] Validations failed: %s', JSON.stringify(_.map(err.errors, function(value, key) { return key; })));
				return api.fail(res, err, 422);
			}
			logger.info('[api|game:create] Validations passed.');
			newGame.save(ok(function(game) {
				logger.info('[api|game:create] Game "%s" created.', game.title);

				// set media to active
				game.activateFiles(okk(function(game) {
					logger.info('[api|game:create] All referenced files activated, returning object to client.');
					return api.success(res, game.toDetailed(), 201);

				}, 'Error activating files for game "%s": %s'));
			}, 'Error saving game with id "%s": %s'));
		});
	});
};


/**
 * Deletes a game.
 * @param req
 * @param res
 */
exports.del = function(req, res) {

	var query = Game.findOne({ id: req.params.id })
		.populate({ path: '_media.backglass' })
		.populate({ path: '_media.logo' });

	query.exec(function(err, game) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[api|game:delete] Error getting game "%s": %s', req.params.id, err, {});
			return api.fail(res, err, 500);
		}
		if (!game) {
			return api.fail(res, 'No such game.', 404);
		}

		// TODO check for linked releases and refuse if referenced

		// remove from db
		game.remove(function(err) {
			/* istanbul ignore if  */
			if (err) {
				logger.error('[api|game:delete] Error deleting game "%s" (%s): %s', game.title, game.id, err, {});
				return api.fail(res, err, 500);
			}
			logger.info('[api|game:delete] Game "%s" (%s) successfully deleted.', game.title, game.id);
			api.success(res, null, 204);
		});
	});
};

/**
 * Lists all games.
 * @param req Request object
 * @param res Response object
 */
exports.list = function(req, res) {

	var query = Game.find()
		.populate({ path: '_media.backglass' })
		.populate({ path: '_media.logo' });

	// text search
	if (req.query.q) {

		if (req.query.q.trim().length < 2) {
			return api.fail(res, 'Query must contain at least two characters.', 400);
		}

		// sanitize and build regex
		var titleQuery = req.query.q.trim().replace(/[^a-z0-9-\s]+/gi, '').replace(/\s+/g, '.*?');
		var titleRegex = new RegExp(titleQuery, 'i');
		var idQuery = req.query.q.trim().replace(/[^a-z0-9-]+/gi, ''); // TODO tune
		query.or([
			{ title: titleRegex },
			{ id: idQuery }
		]);
	}

	query.exec(function(err, games) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[api|game:list] Error: %s', err, {});
			return api.fail(res, err, 500);
		}
		games = _.map(games, function(game) {
			return game.toSimple();
		});
		api.success(res, games);
	});
};


/**
 * Lists a game of a given game ID.
 * @param req Request object
 * @param res Response object
 */
exports.view = function(req, res) {

	var query = Game.findOne({ id: req.params.id })
		.populate({ path: '_media.backglass' })
		.populate({ path: '_media.logo' });

	query.exec(function(err, game) {
		/* istanbul ignore if  */
		if (err) {
			logger.error('[api|game:view] Error finding game "%s": %s', req.params.id, err, {});
			return api.fail(res, err, 500);
		}
		if (!game) {
			return api.fail(res, 'No such game with ID "' + req.params.id + '".', 404);
		}
		return api.success(res, game.toDetailed());
	});
};
