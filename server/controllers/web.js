
exports.partials = function (req, res) {
	var name = req.params.name;
	res.render('partials/' + name);
};

exports.modals = function (req, res) {
	var name = req.params.name;
	res.render('partials/modals/' + name);
};