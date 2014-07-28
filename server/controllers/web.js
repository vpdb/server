var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var logger = require('winston');

var ctrl = require('./ctrl');

/**
 * Authenticates against a given ACL and returns the global view parameters
 *
 *   - If no ACLs are given, the parameters are directly returned
 *   - If ACLs are given, the user must be logged
 *
 * @param resource Resource ACL
 * @param permission Permission ACL
 * @param successFct Called on success. Params: `req`, `res`, `params`, the view parameters
 * @param errFct Called on error. Params: `req`, `res`, `code`, where code is a HTTP error code.
 * @returns {Function}
 */
var auth = function(resource, permission, successFct, errFct) {
	if (resource && permission) {
		return ctrl.auth(resource, permission, function(err, req, res) {
			if (err) {
				return errFct(req, res, err);
			}
			ctrl.viewParams(req, function(params) {
				successFct(req, res, params);
			});
		});
	} else {
		return function(req, res) {
			ctrl.viewParams(req, function(params) {
				successFct(req, res, params);
			});
		};
	}
};

exports.index = function(params1) {
	return function(req, res) {
		ctrl.viewParams(req, function(params2) {
			res.render('index', _.extend({}, params1, params2));
		});
	};
};

exports.styleguide = function() {
	return function(req, res) {
		res.writeHead(200);
		var stream = fs.createReadStream(path.resolve(__dirname, '../../styleguide/index.html'));
		stream.pipe(res);
	}
};

exports.partials = function(subfolder, resource, permission) {
	var prefix = 'partials' + (subfolder ? '/' + subfolder : '');
	return auth(resource, permission, function(req, res, params) {
		res.render(prefix + (req.params.name ? '/' + req.params.name : ''), params);
	}, function(req, res, err) {
		ctrl.renderError(err.code, err.message)(req, res);
	});
};
