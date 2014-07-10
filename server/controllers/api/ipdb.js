var api = require('./api');
var ipdb = require('../../modules/ipdb');

exports.view = function(req, res) {
	api.auth(req, res, 'ipdb', 'view', function() {
		ipdb.details(req.params.id, function(err, game) {
			if (err) {
				api.fail(res, err, 500);
			} else {
				api.success(res, game);
			}
		});

	});
};
