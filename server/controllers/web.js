
exports.index = function (req, res) {
	res.render('index', {
		layout: false,
		js: that.renderJsTags(),
		css: that.renderCssTags(),
		deployment: process.env.APP_NAME
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