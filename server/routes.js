module.exports = function(app, passport, auth) {

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
	app.get('/login', users.login);
	app.get('/signup', users.signup);
	app.get('/logout', users.logout);
	app.post('/users', users.create);
	app.post('/users/session', passport.authenticate('local', { failureRedirect: '/login', failureFlash: 'Invalid email or password.' }), users.session);
	app.get('/users/:userId', users.show);
	app.get('/auth/github', passport.authenticate('github', { failureRedirect: '/login' }), users.signin);
	app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), users.authCallback);

};