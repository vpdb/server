var _ = require('underscore');
var util = require('util');
var logger = require('winston');

var api = require('./api');
var VPBuild = require('mongoose').model('VPBuild');

exports.list = function(req, res) {

	var q;
	if (req.user) {
		// logged users also get their own vpbuilds even if inactive.
		q = { $or: [{ is_active: true }, { _created_by: req.user._id }] };
	} else {
		q = { is_active: true };
	}
	VPBuild.find(q, function(err, vpbuilds) {
		if (err) {
			logger.error('[api|vpbuild:list] Error: %s', err, {});
			return api.fail(res, err, 500);
		}

		// reduce
		vpbuilds = _.map(vpbuilds, function(vpbuild) {
			return vpbuild.toSimple();
		});
		api.success(res, vpbuilds);
	});
};


exports.create = function(req, res) {

	var newBuild = new VPBuild(req.body);

	newBuild.id = newBuild.name ? newBuild.name.replace(/(^[^a-z0-9]+)|([^a-z0-9]+$)/gi, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase() : '-';
	newBuild.is_active = false;
	newBuild.created_at = new Date();
	newBuild._created_by = req.user._id;

	newBuild.validate(function(err) {
		if (err) {
			logger.warn('[api|vpbuild:create] Validations failed: %s', util.inspect(_.map(err.errors, function(value, key) { return key; })));
			return api.fail(res, err, 422);
		}
		newBuild.save(function(err) {
			if (err) {
				logger.error('[api|vpbuild:create] Error saving vpbuild "%s": %s', newBuild.name, err, {});
				return api.fail(res, err, 500);
			}
			logger.info('[api|vpbuild:create] VPBuild "%s" successfully created.', newBuild.name);
			return api.success(res, newBuild.toSimple(), 201);
		});
	});
};