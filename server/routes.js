module.exports = function (app) {

	var web = require('./controllers/web');

	app.get('/', web.index);
	app.get('/games', web.index);
	app.get('/game', web.index);
	app.get('/game/*', web.index);
	app.get('/home', web.index);

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