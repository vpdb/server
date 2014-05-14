var _ = require('underscore');

module.exports = function(app, config, passport, auth) {

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

	// user routes
	var users = require('./controllers/users');
	app.get('/logout', users.logout);
	app.post('/users', users.create);
	app.post('/users/session', passport.authenticate('local', { failureRedirect: '/', failureFlash: 'Invalid email or password.' }), users.session);
	app.get('/users/:userId', users.show);

	// authentication routes
	if (config.vpdb.passport.github.enabled) {
		app.get('/auth/github', passport.authenticate('github', { failureRedirect: '/' }), users.signin);
		app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/' }), users.authCallback);
	}
	_.each(config.vpdb.passport.ipboard, function(ipbConfig) {
		if (ipbConfig.enabled) {
			app.get('/auth/' + ipbConfig.id, passport.authenticate(ipbConfig.id, { failureRedirect: '/' }), users.signin);
			app.get('/auth/' + ipbConfig.id + '/callback', passport.authenticate(ipbConfig.id, { failureRedirect: '/' }), users.authCallback);
		}
	});
};