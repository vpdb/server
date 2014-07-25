var _ = require('underscore');
var util = require('util');
var logger = require('winston');

var Game = require('mongoose').model('Game');
var File = require('mongoose').model('File');
var api = require('./api');
var storage = require('../../modules/storage');


/**
 * Returns either 200 or 404. Useful for checking if a given game ID already exists.
 * @param req Request object
 * @param res Response object
 */
exports.head = function(req, res) {
	Game.findOne({ id: req.params.id }, function(err, game) {
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

	Game.getInstance(req.body, function(err, newGame) {
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
			Game.findOne({ id: newGame.id }, ok(function(game) {
				if (!game) {
					newGame.save(ok(function(game) {
						logger.info('[api|game:create] Game "%s" created.', game.title);

						// set media to active
						game.activateFiles(okk(function(game) {
							logger.info('[api|game:create] All referenced files activated, returning object to client.');
							return api.success(res, game.toDetailed(), 201);

						}, 'Error activating files for game "%s": %s'));
					}, 'Error saving game with id "%s": %s'));
				} else {
					logger.warn('[api|game:create] Game <%s> already in database, aborting.', newGame.email);
					return api.fail(res, 'Game "' + newGame.id + '" already exists.', 409);
				}
			}, 'Error finding game with id "%s": %s'));
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
		// sanitize and build regex
		var q = req.query.q.trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, '.*');
		var regex = new RegExp(q, 'i');
		query.or([
			{ title: regex },
			{ game_id: regex }
		]);
	}

	query.exec(function(err, games) {
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
		if (err) {
			logger.error('[api|game:head] Error finding game "%s": %s', req.params.id, err, {});
			return api.fail(res, err, 500);
		}
		if (!game) {
			return api.fail(res, 'No such game with ID "' + req.params.id + '".', 404);
		}
		return api.success(res, game.toDetailed());
	});
};
