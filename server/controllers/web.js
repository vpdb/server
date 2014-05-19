var _ = require('underscore');
var logger = require('winston');

var acl = require('../acl');
var assets = require('../config/assets');
var config = require('../modules/settings').current;
var userApi = require('./api/users');

var params = function(req, done) {

	var params = {
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
		authStrategies: {
			local: true,
			github: config.vpdb.passport.github.enabled,
			ipboard: _.map(_.filter(config.vpdb.passport.ipboard, function(ipbConfig) { return ipbConfig.enabled }), function(ipbConfig) {
				return {
					name: ipbConfig.name,
					icon: ipbConfig.icon,
					url: '/auth/' + ipbConfig.id
				};
			})
		},
		auth: {
			isAuthenticated: req.isAuthenticated(),
			user: req.isAuthenticated() ? _.pick(req.user, _.union(userApi.fields.pub, userApi.fields.adm)) : null
		}
	};
	if (req.isAuthenticated()) {
		acl.allowedPermissions(req.user.email, [ 'users', 'content' ], function(err, permissions) {
			if (err) {
				logger.error('[webctrl] Error reading permissions for user <%s>: %s', req.user.email, err);
			} else {
				params.auth.permissions = permissions;
			}
			acl.userRoles(req.user.email, function(err, roles) {
				if (err) {
					logger.error('[webctrl] Error reading roles for user <%s>: %s', req.user.email, err);
				} else {
					params.auth.roles = roles;
				}
				done(params);
			});
		});
	} else {
		done(params);
	}
};

var showError = function(errCode, req, res) {
	params(req, function(params) {
		res.status(errCode).render('errors/' + errCode, _.extend(params, { url: req.originalUrl }));
	});
};


var protectedRoute = function(resource, permission, successFct, errFct) {
	if (resource && permission) {
		return function(req, res) {
			if (req.isAuthenticated()) {
				acl.isAllowed(req.user.email, resource, permission, function (err, granted) {
					if (err) {
						logger.error('[partialsctrl] Error checking ACLs for user <%s>: %s', req.user.email, err);
						return showError(500, req, res);
					}
					if (granted) {
						params(req, function(params) {
							successFct(req, res, params);
						});
					} else {
						errFct(req, res);
					}
				});
			} else {
				errFct(req, res);
			}
		};
	} else {
		return function(req, res) {
			params(req, function(params) {
				successFct(req, res, params);
			});
		};
	}
};

exports.index = function(resource, permission) {
	return protectedRoute(resource, permission, function(req, res, params) {
		res.render('index', params);
	}, function(req, res) {
		showError(403, req, res);
	});
};

exports.partials = function(subfolder, resource, permission) {
	var prefix = 'partials' + (subfolder ? '/' + subfolder : '');
	return protectedRoute(resource, permission, function(req, res, params) {
		res.render(prefix + (req.params.name ? '/' + req.params.name : ''), params);
	}, function(req, res) {
		res.status(403).end();
	});
};

exports.show404 = function(req, res) {
	if (req.originalUrl.substr(0, 5) == '/api/') {
		res.setHeader('Content-Type', 'application/json');
		res.status(404).end(JSON.stringify({ error: 'Not found.' }));
	} else {
		showError(404, req, res);
	}
};

