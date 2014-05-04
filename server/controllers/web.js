var _ = require('underscore');
var assets = require('../config/assets');

exports.index = function (req, res) {
	res.render('index', {
		layout: false,
		deployment: process.env.APP_NAME,
		environment: process.env.NODE_ENV || 'development',
		jsFiles: _.map(assets.js, function(js) {
			return '/' + js;
		}),
		cssFiles: _.map(_.union(assets.css, assets.cssCache), function(css) {
			return '/css/' + css;
		})
	});
};

exports.partials = function (req, res) {
	var name = req.params.name;
	res.render('partials/' + name);
};

exports.modals = function (req, res) {
	var name = req.params.name;
	res.render('partials/modals/' + name);
};