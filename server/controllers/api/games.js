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


exports.list = function(req, res) {
};

exports.update = function(req, res) {
};

