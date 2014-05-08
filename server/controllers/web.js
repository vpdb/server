var _ = require('underscore');
var assets = require('../config/assets');
var config = require('./../modules/settings').current;

exports.params = function(req) {
	return {
		layout: false,
		deployment: process.env.APP_NAME,
		environment: process.env.NODE_ENV || 'development',
		jsFiles: _.map(assets.js, function(js) {
			return '/' + js;
		}),
		cssFiles: _.map(_.union(assets.css, assets.cssCache), function(css) {
			return '/css/' + css;
		}),
		req: req,
		auth: {
			local: true,
			github: config.vpdb.passport.github.enabled,
			ipboard: _.map(config.vpdb.passport.ipboard, function(ipbConfig) {
				return {
					name: ipbConfig.name,
					icon: ipbConfig.icon,
					url: '/auth/' + ipbConfig.id
				};
			})
		}
	};
};

exports.index = function (req, res) {
	res.render('index', exports.params(req));
};

exports.partials = function (req, res) {
	var name = req.params.name;
	res.render('partials/' + name, exports.params(req));
};

exports.modals = function (req, res) {
	var name = req.params.name;
	res.render('partials/modals/' + name, exports.params(req));
};

