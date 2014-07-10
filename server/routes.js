var _ = require('underscore');

module.exports = function(app, config, passport) {

	var api = require('./controllers/api');
	var web = require('./controllers/web');
	var storage = require('./controllers/storage');

	app.get('/', web.index());
	app.get('/games', web.index());
	app.get('/game', web.index());
	app.get('/game/*', web.index());
	app.get('/games/add', web.index());
	app.get('/admin/users', web.index());
	app.get('/styleguide/sections/*', web.styleguide());

	// serve index and view partials
	app.get('/partials/:name', web.partials());
	app.get('/partials/admin/users', web.partials('admin/users', 'users', '*'));
	app.get('/partials/admin/game-add', web.partials('admin/game-add', 'games', 'edit'));
	app.get('/partials/admin/modals/:name', web.partials('admin/modals', 'users', '*'));
	app.get('/partials/modals/:name', web.partials('modals'));

	// JSON API
	app.post('/api/authenticate', api.users.authenticate);
	app.post('/api/users',        api.users.create);
	app.get('/api/users',         api.auth(api.users.list, 'users', 'list'));
	app.put('/api/users/:id',     api.auth(api.users.update, 'users', 'update'));
	app.get('/api/user',          api.auth(api.users.profile, 'user', 'profile'));

	app.get('/api/roles',         api.auth(api.roles.list, 'roles', 'list'));

	app.get('/api/ipdb/:id',      api.auth(api.ipdb.view, 'ipdb', 'view'));

	app.put('/api/files',         api.auth(api.files.upload, 'files', 'upload'));

	app.head('/api/games/:id',    api.games.head);
	app.post('/api/games',        api.auth(api.games.create, 'games', 'add'));

	app.get('/api/ping',          api.anon(api.ping));

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
		app.get('/auth/github', passport.authenticate('github', { failureRedirect: '/', session: false }));
		app.get('/auth/github/callback', api.passport('github', passport, web));
	}
	_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
		if (ipbConfig.enabled) {
			app.get('/auth/' + ipbConfig.id, passport.authenticate(ipbConfig.id, { failureRedirect: '/' }));
			app.get('/auth/' + ipbConfig.id + '/callback', passport.authenticate(ipbConfig.id, { failureRedirect: '/', successRedirect: '/' }));
		}
	});
};