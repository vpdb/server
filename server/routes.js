var _ = require('underscore');

module.exports = function(app, config, passport) {

	var web = require('./controllers/web');

	app.get('/', web.index);
	app.get('/games', web.index);
	app.get('/game', web.index);
	app.get('/game/*', web.index);
	app.get('/admin/users', web.index);

	// serve index and view partials
	app.get('/partials/:name', web.partials);
	app.get('/partials/modals/:name', web.modals);

	// JSON API
	var userApi = require('./controllers/api/users');
	app.get('/api/users', userApi.list);
	app.post('/api/users', userApi.create);
	app.post('/api/users/login', userApi.login);
	app.post('/api/users/logout', userApi.logout);

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