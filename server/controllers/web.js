
exports.index = function (req, res) {
	res.render('index', {
		layout: false,
		deployment: process.env.APP_NAME,
		environment: process.env.NODE_ENV || 'development'
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