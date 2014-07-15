var _ = require('underscore');
var util = require('util');
var logger = require('winston');

var Game = require('mongoose').model('Game');
var File = require('mongoose').model('File');
var api = require('./api');
var storage = require('../../modules/storage');

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
	var ok = api.ok('game', 'create', newGame.game_id, res);
	var okk = api.ok('game', 'create', newGame.game_id, res, function(done) {
		newGame.remove(done);
	});
	logger.info('[api|game:create] %s', util.inspect(req.body));
	newGame.validate(function(err) {
		if (err) {
			logger.warn('[api|game:create] Validations failed: %s', util.inspect(_.map(err.errors, function(value, key) { return key; })));
			return api.fail(res, err, 422);
		}
		logger.info('[api|game:create] Validations passed.');
		Game.findOne({ game_id: newGame.game_id }).exec(ok(function(game) {
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
				return api.fail(res, 'Game "' + newGame.game_id + '" already exists.', 409);
			}
		}, 'Error finding game with id "%s": %s'));
	});
};

exports.list = function(req, res) {

	var query = Game.find().select('-__v').populate({ path: 'media.backglass' }).populate({ path: 'media.logo' });

	// text search
	if (req.query.q) {
		// sanitize and build regex
		var q = req.query.q.trim().replace(/[^a-z0-9]+/gi, ' ').replace(/\s+/g, '.*');
		var regex = new RegExp(q, 'i');
		query.or([
			{ title: regex },
			{ gameid: regex }
		]);
	}

	query.exec(function(err, games) {
		if (err) {
			logger.error('[api|game:list] Error: %s', err, {});
			return api.fail(res, err, 500);
		}
		games = _.map(games, function(game) {
			return _.extend(
				_.pick(game, 'game_id', 'title', 'manufacturer', 'year', 'game_type', 'ipdb'),
				{ media: {
					backglass: {
						url: storage.url(game.media.backglass),
						variations: storage.urls(game.media.backglass)
					},
					logo: {
						url: storage.url(game.media.logo),
						variations: storage.urls(game.media.logo)
					}
				}});
		});
		api.success(res, games);
	});
};

exports.update = function(req, res) {
};

