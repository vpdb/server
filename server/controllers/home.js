
function HomeController(assets) {
	this.assets = assets;
}

HomeController.prototype.index = function(req, res) {
	var that = this;
	res.render('index', {
		layout: false,
		js: that.renderJsTags(),
		css: that.renderCssTags(),
		deployment: process.env.APP_NAME
	});
};

HomeController.prototype.partials = function(req, res) {
	var name = req.params.name;
	res.render('partials/' + name);
};

HomeController.prototype.modals = function(req, res) {
	var name = req.params.name;
	res.render('partials/modals/' + name);
};

module.exports = HomeController;