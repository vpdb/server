var _ = require('underscore');
var util = require('util');
var logger = require('winston');

var Game = require('mongoose').model('Game');
var File = require('mongoose').model('File');
var acl = require('../../acl');
var api = require('./api');

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

	var newGame = new Game(req.body);
	var ok = api.ok('game', 'create', newGame.gameId, res);
	var okk = api.ok('game', 'create', newGame.gameId, res, function(done) {
		newGame.remove(done);
	});
	logger.info('[api|game:create] %s', util.inspect(req.body));
	newGame.validate(function(err) {
		if (err) {
			logger.warn('[api|game:create] Validations failed: %s', util.inspect(_.map(err.errors, function(value, key) { return key; })));
			return api.fail(res, err, 422);
		}
		logger.info('[api|game:create] Validations passed.');
		Game.findOne({ gameId: newGame.gameId }).exec(ok(function(game) {
			if (!game) {
				newGame.save(ok(function(game) {
					logger.info('[api|game:create] Game "%s" created.', game.title);

					// set media to active
					File.findById(newGame.media.backglass, okk(function(backglass) {
						backglass.active = true;
						backglass.public = true;
						backglass.save(okk(function(backglass) {
							logger.info('[api|game:create] Set backglass to active.');
							if (newGame.media.logo) {
								File.findById(newGame.media.logo, okk(function(logo) {
									logo.active = true;
									logo.public = true;
									logo.save(okk(function(logo) {
										logger.info('[api|game:create] Set logo to active.');
										return api.success(res, newGame.toJSON(), 201);
									}, 'Error saving logo for game "%s": %s'));
								}, 'Error finding logo for game "%s": %s'));
							} else {
								return api.success(res, newGame.toJSON(), 201);
							}
						}, 'Error saving backglass for game "%s": %s'));
					}, 'Error finding backglass for game "%s": %s'));
				}, 'Error saving game "%s": %s'));
			} else {
				logger.warn('[api|game:create] Game <%s> already in database, aborting.', newGame.email);
				return api.fail(res, 'Game "' + newGame.gameId + '" already exists.', 409);
			}
		}, 'Error finding game with id "%s": %s'));
	});
};

exports.list = function(req, res) {
};

exports.update = function(req, res) {
};

