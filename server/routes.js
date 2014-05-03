var Home = require('../server/controllers/home');

module.exports = function(app, passport, auth, assets) {

	// user routes
	var users = require('../server/controllers/users');
	app.get('/login', users.login);
	app.get('/signup', users.signup);
	app.get('/logout', users.logout);
	app.post('/users', users.create);
	app.post('/users/session', passport.authenticate('local', { failureRedirect: '/login', failureFlash: 'Invalid email or password.'}), users.session);
	app.get('/users/:userId', users.show);
	app.get('/auth/github', passport.authenticate('github', { failureRedirect: '/login' }), users.signin);
	app.get('/auth/github/callback', passport.authenticate('github', { failureRedirect: '/login' }), users.authCallback);

	// frontend routes
	var home = new Home(assets);
	app.get('/', home.index);
	app.get('/games', home.index);
	app.get('/game', home.index);
	app.get('/game/*', home.index);
	app.get('/home', home.index);

	// modals and partials
	app.get('/partials/:name', home.partials);
	app.get('/partials/modals/:name', home.modals);

	// JSON API
	var api = require('../server/controllers/api');
	app.get('/api/games/:id', api.game);
	app.get('/api/games', api.games);
	app.get('/api/packs', api.packs);
	app.get('/api/releases', api.releases);
	app.get('/api/feed', api.feed);
	app.get('/api/users', api.users);
	app.get('/api/users/:user', api.user);

};
