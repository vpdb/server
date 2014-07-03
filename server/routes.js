var _ = require('underscore');

module.exports = function(app, config, passport) {

	var web = require('./controllers/web');
	var storage = require('./controllers/storage');

	app.get('/', web.index());
	app.get('/games', web.index());
	app.get('/game', web.index());
	app.get('/game/*', web.index());
	app.get('/games/add', web.index('games', 'edit'));
	app.get('/admin/users', web.index('users', 'list'));
	app.get('/styleguide/sections/*', web.styleguide());

	// serve index and view partials
	app.get('/partials/:name', web.partials());
	app.get('/partials/admin/users', web.partials('admin/users', 'users', '*'));
	app.get('/partials/admin/game-add', web.partials('admin/game-add', 'games', 'edit'));
	app.get('/partials/admin/modals/:name', web.partials('admin/modals', 'users', '*'));
	app.get('/partials/modals/:name', web.partials('modals'));

	// JSON API
	var userApi = require('./controllers/api/users');
	app.get('/api/users', userApi.list);
	app.put('/api/users/:id', userApi.update);
	app.post('/api/users', userApi.create);
	app.post('/api/users/login', userApi.login);
	app.post('/api/users/logout', userApi.logout);

	var rolesApi = require('./controllers/api/roles');
	app.get('/api/roles', rolesApi.list);

	var ipdbApi = require('./controllers/api/ipdb');
	app.get('/api/ipdb/:id', ipdbApi.view);

	var filesApi = require('./controllers/api/files');
	app.put('/api/files', filesApi.upload);

	var gamesApi = require('./controllers/api/games');
	app.head('/api/games/:id', gamesApi.head);
	app.post('/api/games', gamesApi.create);

	// Storage
	app.get('/storage/:id', storage.get);

	// JSON API (mock)
	var apiMock = require('./controllers/api-mock');
	app.get('/api-mock/games/:id', apiMock.game);
	app.get('/api-mock/games', apiMock.games);
	app.get('/api-mock/packs', apiMock.packs);
	app.get('/api-mock/releases', apiMock.releases);
	app.get('/api-mock/feed', apiMock.feed);
	app.get('/api-mock/users', apiMock.users);
	app.get('/api-mock/users/:user', apiMock.user);

	// authentication routes
	if (config.vpdb.passport.github.enabled) {
		app.get('/auth/github', passport.authenticate('github', { failureRedirect: '/' }));
		app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/', successRedirect: '/' }));
	}
	_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
		if (ipbConfig.enabled) {
			app.get('/auth/' + ipbConfig.id, passport.authenticate(ipbConfig.id, { failureRedirect: '/' }));
			app.get('/auth/' + ipbConfig.id + '/callback', passport.authenticate(ipbConfig.id, { failureRedirect: '/', successRedirect: '/' }));
		}
	});
};