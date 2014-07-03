var _ = require('underscore');
var util = require('util');
var logger = require('winston');

var Game = require('mongoose').model('Game');
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
		logger.info('[api|game:create] %s', util.inspect(req.body));
		newGame.validate(function(err) {
			if (err) {
				logger.warn('[api|game:create] Validations failed: %s', util.inspect(_.map(err.errors, function(value, key) { return key; })));
				return api.fail(res, err, 422);
			}
			logger.info('[api|game:create] Validations passed, checking for existing game.');
			Game.findOne({ gameId: newGame.gameId }).exec(function(err, game) {
				if (err) {
					logger.error('[api|game:create] Error finding game with id "%s": %s', newGame.gameId, err, {});
					return api.fail(res, err);
				}
				if (!game) {
					newGame.save(function(err) {
						if (err) {
							logger.error('[api|game:create] Error saving game "%s": %s', newGame.gameId, err, {});
							return api.fail(res, err, 500);
						}
						logger.info('[api|game:create] Success!');
						return api.success(res, _.omit(newGame.toJSON(), 'passwordHash', 'passwordSalt'), 201);
					});
				} else {
					logger.warn('[api|game:create] Game <%s> already in database, aborting.', newGame.email);
					return api.fail(res, 'Game "' + newGame.gameId + '" already exists.', 409);
				}
			});
		});
	});
};

exports.list = function(req, res) {
};

exports.update = function(req, res) {
};

