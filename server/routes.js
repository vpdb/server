module.exports = function (app, assets) {

	var web = require('./controllers/web');

	app.get('/', assets.renderIndex);
	app.get('/games', assets.renderIndex);
	app.get('/game', assets.renderIndex);
	app.get('/game/*', assets.renderIndex);
	app.get('/home', assets.renderIndex);

	// serve index and view partials
	app.get('/partials/:name', web.partials);
	app.get('/partials/modals/:name', web.modals);

	// JSON API
	var api = require('./controllers/api');
	app.get('/api/games/:id', api.game);
	app.get('/api/games', api.games);
	app.get('/api/packs', api.packs);
	app.get('/api/releases', api.releases);
	app.get('/api/feed', api.feed);
	app.get('/api/users', api.users);
	app.get('/api/users/:user', api.user);
};