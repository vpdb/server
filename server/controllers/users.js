var logger = require('winston');
var mongoose = require('mongoose');
var User = mongoose.model('User');

exports.signin = function(req, res) {
};

/**
 * Auth callback
 */
exports.authCallback = function(req, res, next) {
	res.redirect('/');
};


/**
 * Logout
 */
exports.logout = function(req, res) {
	req.logout();
	res.redirect('/');
};

/**
 * Session
 */
exports.session = function(req, res) {
	res.redirect('/');
};


/**
 *  Show profile
 */
exports.show = function(req, res) {
	User
		.findOne({ _id: req.params['userId'] })
		.exec(function(err, user) {
			if (err) {
				return next(err);
			}
			if (!user){
				return next(new Error('Failed to load User ' + id));
			}

			res.render('users/show', {
				title: user.name,
				user: user
			});
		});
};

/**
 * Find user by id
 */
exports.user = function(req, res, next, id) {
	User
		.findOne({ _id: id })
		.exec(function(err, user) {
			if (err) {
				return next(err);
			}
			if (!user) {
				return next(new Error('Failed to load User ' + id));
			}
			req.profile = user;
			next();
		});
};
