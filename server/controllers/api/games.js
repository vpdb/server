var _ = require('underscore');
var util = require('util');
var logger = require('winston');

var Game = require('mongoose').model('Game');
var File = require('mongoose').model('File');
var acl = require('../../acl');
var api = require('./common');

exports.head = function(req, res) {
	Game.findOne({ gameId: req.params.id }, '-__v', function(err, game) {
		if (err) {
			logger.error('[api|game:head] Error finding game "%s": %s', req.params.id, err, {});
			return api.fail(res, err, 500);
		}
		return api.success(res, null, game ? 200 : 404);
	});
};

exports.create = function(req, res) {

	api.auth(req, res, 'games', 'add', function() {
		var newGame = new Game(req.body);
		var ok = api.ok('game', 'create', newGame.gameId, res);
		var okk = api.ok('game', 'create', newGame.gameId, res, function(callback) {
			newGame.remove(callback);
		});
		logger.info('[api|game:create] %s', util.inspect(req.body));
		newGame.validate(function(err) {
			if (err) {
				logger.warn('[api|game:create] Validations failed: %s', util.inspect(_.map(err.errors, function(value, key) { return key; })));
				return api.fail(res, err, 422);
			}
			logger.info('[api|game:create] Validations passed, checking for existing game.');
			Game.findOne({ gameId: newGame.gameId }).exec(ok(function(game) {
				if (!game) {
					newGame.save(ok(function(game) {
						logger.info('[api|game:create] Success!');

						// set media to active
						File.findById(newGame.media.backglass, okk(function(backglass) {
							backglass.active = true;
							backglass.save(okk(function(backglass) {
								logger.info('[api|game:create] Set backglass to active.');
								return api.success(res, _.omit(newGame.toJSON(), 'passwordHash', 'passwordSalt'), 201);

							}, 'Error saving backglass for game "%s": %s'));
						}, 'Error finding backglass for game "%s": %s'));
					}, 'Error saving game "%s": %s'));
				} else {
					logger.warn('[api|game:create] Game <%s> already in database, aborting.', newGame.email);
					return api.fail(res, 'Game "' + newGame.gameId + '" already exists.', 409);
				}
			}, 'Error finding game with id "%s": %s'));
		});
	});
};

exports.list = function(req, res) {
};

exports.update = function(req, res) {
};

