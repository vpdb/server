"use strict";

var _ = require('underscore');

module.exports = function(app, config, passport) {

	var api = require('./controllers/api');
	var web = require('./controllers/web');
	var ctrl = require('./controllers/ctrl');
	var storage = require('./controllers/storage');

	app.get('/', web.index());
	app.get('/games', web.index());
	app.get('/game', web.index());
	app.get('/game/*', web.index());
	app.get('/games/add', web.index());
	app.get('/releases/add', web.index());
	app.get('/admin/users', web.index());
	app.get('/styleguide/sections/*', web.styleguide());

	// serve index and view partials
	app.get('/partials/:name', web.partials());
	app.get('/partials/member/release-add', web.partials('member/release-add', 'releases', 'add'));
	app.get('/partials/member/modals/author-add', web.partials('member/modals/author-add', 'releases', 'add'));
	app.get('/partials/member/modals/tag-create', web.partials('member/modals/tag-create', 'releases', 'add'));
	app.get('/partials/member/modals/vpbuild-create', web.partials('member/modals/vpbuild-create', 'releases', 'add'));
	app.get('/partials/admin/users', web.partials('admin/users', 'users', 'update'));
	app.get('/partials/admin/game-add', web.partials('admin/game-add', 'games', 'update'));
	app.get('/partials/admin/modals/:name', web.partials('admin/modals', 'users', 'update'));
	app.get('/partials/modals/:name', web.partials('modals'));

	// JSON API
	app.post('/api/authenticate', api.users.authenticate);
	app.post('/api/users',        api.users.create);
	app.get('/api/users',         api.auth(api.users.list, 'users', 'search'));
	app.put('/api/users/:id',     api.auth(api.users.update, 'users', 'update'));
	app.delete('/api/users/:id',  api.auth(api.users.del, 'users', 'delete'));
	app.get('/api/user',          api.auth(api.users.profile, 'user', 'profile'));

	app.get('/api/roles',         api.auth(api.roles.list, 'roles', 'list'));

	app.get('/api/ipdb/:id',      api.auth(api.ipdb.view, 'ipdb', 'view'));

	app.get('/api/tags',          api.anon(api.tags.list));
	app.post('/api/tags',         api.auth(api.tags.create, 'tags', 'add'));

	app.get('/api/vpbuilds',      api.anon(api.vpbuilds.list));
	app.post('/api/vpbuilds',     api.auth(api.vpbuilds.create, 'vpbuilds', 'add'));

	app.post('/api/files',        api.auth(api.files.upload, 'files', 'upload'));
	app.get('/api/files/:id',     api.anon(api.files.view));
	app.delete('/api/files/:id',  api.auth(api.files.del, 'files', 'delete'));

	app.get('/api/games',         api.anon(api.games.list));
	app.head('/api/games/:id',    api.anon(api.games.head));
	app.get('/api/games/:id',     api.anon(api.games.view));
	app.post('/api/games',        api.auth(api.games.create, 'games', 'add'));
	app.delete('/api/games/:id',  api.auth(api.games.del, 'games', 'delete'));

	app.get('/api/ping',          api.anon(api.ping));

	// Storage
	app.get('/storage/:id',            api.anon(storage.get));  // permission/quota handling is inside.
	app.get('/storage/:id/:variation', api.anon(storage.get));

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
		app.get('/auth/github/callback', ctrl.passport('github', passport, web));
	}
	_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
		if (ipbConfig.enabled) {
			app.get('/auth/' + ipbConfig.id, passport.authenticate(ipbConfig.id, { failureRedirect: '/' }));
			app.get('/auth/' + ipbConfig.id + '/callback', passport.authenticate(ipbConfig.id, { failureRedirect: '/', successRedirect: '/' }));
		}
	});

	// mock route for simulating oauth2 callbacks
	if (process.env.NODE_ENV !== 'production') {
		app.post('/auth/mock', ctrl.passportMock(web));
	}
};