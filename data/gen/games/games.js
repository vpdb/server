"use strict";

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var request = require('superagent');

exports.upload = function(config) {

	config = config || {};
	var apiUri = config.apiUri || 'http://localhost:3000/api/v1';
	var storageUri = config.storageUri || 'http://localhost:3000/storage/v1';
	var authHeader = config.authHeader || 'Authorization';
	var credentials = config.credentials || {};

	var token;
	var ipdb = require('../../ipdb.json');

	console.log('Local index with %d entries loaded.', ipdb.length);
	async.series([
		function(callback) {
			request
				.post(apiUri + '/authenticate')
				.send(credentials)
				.end(function(err, res) {
					if (err) {
						console.error('Error obtaining token: %s', err);
						return callback(err);
					}
					if (res.status !== 200) {
						console.error('Error obtaining token: %j', res.body);
						return callback(new Error(res.body));
					}
					console.log('Authentication successful.');
					token = res.body.token;
					callback();
				});
		},
		function(callback) {
			var bgPrefix = path.resolve(__dirname, 'backglass');
			var logoPrefix = path.resolve(__dirname, 'logo');

			console.log('Reading backglasses from %s.', bgPrefix);
			console.log('Reading logos from %s.', logoPrefix);

			async.eachSeries(exports.data, function(game, next) {
				var data = _.find(ipdb, function(g) { return g.ipdb.number === game.ipdb; });

				if (!data) {
					console.warn('No game in local index found with IPDB# %s.', game.ipdb);
					return next();
				}

				if (!game.bg || !game.logo) {
					console.log('Skipping "%s" due to incomplete media.', data.title);
					return next();
				}

				console.log('Adding game "%s"...', data.title);

				var bg = fs.readFileSync(path.resolve(bgPrefix, game.bg));

				request
					.post(storageUri + '/files')
					.query({ type: 'backglass' })
					.type('image/png')
					.set('Content-Disposition', 'attachment; filename="' + game.bg + '"')
					.set('Content-Length', bg.length)
					.set(authHeader, 'Bearer ' + token)
					.send(bg)
					.end(function(res) {
						var bgRef = res.body.id;
						var logo = fs.readFileSync(path.resolve(logoPrefix, game.logo));

						request
							.post(storageUri + '/files')
							.query({ type: 'logo' })
							.type('image/png')
							.set('Content-Disposition', 'attachment; filename="' + game.logo + '"')
							.set('Content-Length', logo.length)
							.set(authHeader, 'Bearer ' + token)
							.send(logo)
							.end(function(res) {
								var logoRef = res.body.id;

								if (data.short) {
									data.id = data.short[0].replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
								} else {
									data.id = data.title.replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
								}
								data.year = data.year || 1900;
								data.game_type = data.game_type || 'na';
								data.manufacturer = data.manufacturer || 'unknown';
								data._media = { backglass: bgRef, logo: logoRef };

								request
									.post(apiUri + '/games')
									.type('application/json')
									.set(authHeader, 'Bearer ' + token)
									.send(data)
									.end(function(res) {
										console.log(res.body);
										next();
									});
							});
					});

			}, callback);
		}
	],
	function(err, results) {
		if (err) {
			return console.log('failed.');
		}
		console.log('done!');
	});
};

exports.data = [
	{ bg: 'Abra Ca Dabra (Gottlieb 1975).png', logo: 'Abra Ca Dabra (Gottlieb 1975).png', ipdb: 2 },
	{ bg: 'Attack from Mars (Bally 1995).png', logo: 'Attack from Mars (Bally 1995).png', ipdb: 3781 },
	{ bg: 'Back to the Future (Data East 1990).png', logo: 'Back to the Future (Data East 1990).png', ipdb: 126 },
	{ bg: null, logo: 'Banzai Run (Williams 1988).png', ipdb: 175 },
	{ bg: 'Big Bang Bar (Capcom 1996).png', logo: 'Big Bang Bar (Capcom 1996).png', ipdb: 4001 },
	{ bg: 'Black Knight (Williams 1980).png', logo: null, ipdb: 310 },
	{ bg: 'Black Knight 2000 (Williams 1989).png', logo: 'Black Knight 2000 (Williams 1989).png', ipdb: 311 },
	{ bg: 'Black Rose (Bally 1992).png', logo: 'Black Rose (Bally 1992).png', ipdb: 313 },
	{ bg: null, logo: 'Bone Busters (Gottlieb 1989).png', ipdb: 347 },
	{ bg: 'Bram Stokers Dracula (Williams 1993).png', logo: 'Bram Stokers Dracula (Williams 1993).png', ipdb: 3072 },
	{ bg: 'Bride Of Pinbot (Williams 1991).png', logo: 'Bride Of Pinbot (Williams 1991).png', ipdb: 1502 },
	{ bg: 'Cactus Canyon (Midway 1998).png', logo: 'Cactus Canyon (Midway 1998).png', ipdb: 4445 },
	{ bg: 'Centaur (Bally 1981).png', logo: 'Centaur (Bally 1981).png', ipdb: 476 },
	{ bg: 'Centigrade 37 (Gottlieb 1977).png', logo: 'Centigrade 37 (Gottlieb 1977).png', ipdb: 480 },
	{ bg: 'Cirqus Voltaire Night Mod (Bally 1997).png', logo: 'Cirqus Voltaire (Bally 1997).png', ipdb: 4059 },
	{ bg: 'Congo (Williams 1995).png', logo: 'Congo (Williams 1995).png', ipdb: 3780 },
	{ bg: 'Creature from the Black Lagoon (Bally 1992).png', logo: 'Creature from the Black Lagoon (Bally 1992).png', ipdb: 588 },
	{ bg: 'Cyclone (Williams 1981).png', logo: 'Cyclone (Williams 1981).png', ipdb: 617 },
	{ bg: 'Demolition Man (Williams 1994).png', logo: 'Demolition Man (Williams 1994).png', ipdb: 662 },
	{ bg: 'Diner (Williams 1990).png', logo: 'Diner (Williams 1990).png', ipdb: 681 },
	{ bg: 'Doctor Who (Bally 1992).png', logo: 'Doctor Who (Bally 1992).png', ipdb: 738 },
	{ bg: 'Dr Dude (Midway 1990).png', logo: 'Dr Dude (Midway 1990).png', ipdb: 737 },
	{ bg: 'Earthshaker (Williams 1989).png', logo: 'Earthshaker (Williams 1989).png', ipdb: 753 },
	{ bg: 'Elvira and the Party Monsters (Bally 1995).png', logo: 'Elvira and the Party Monsters (Bally 1995).png', ipdb: 782 },
	{ bg: 'FirePower (Williams 1980).png', logo: 'FirePower (Williams 1980).png', ipdb: 856 },
	{ bg: 'Fish Tales (Williams 1992).png', logo: 'Fish Tales (Williams 1992).png', ipdb: 861 },
	{ bg: 'Flintstones, The (Williams 1994).png', logo: 'Flintstones (Williams 1994).png', ipdb: 888 },
	{ bg: 'Funhouse (Williams 1990).png', logo: 'Funhouse (Williams 1990).png', ipdb: 966 },
	{ bg: 'Getaway - High Speed II (Williams 1992).png', logo: 'Getaway - High Speed II (Williams 1992).png', ipdb: 1000 },
	{ bg: null, logo: 'Guns and Roses (Data East 1994).png', ipdb: 1100 },
	{ bg: null, logo: 'Haunted House (Gottlieb 1982).png', ipdb: 1133 },
	{ bg: 'Indiana Jones (Williams 1993).png', logo: 'Indiana Jones (Williams 1993).png', ipdb: 1267 },
	{ bg: 'Indianapolis 500 (Midway 1995).png', logo: 'Indianapolis 500 (Midway 1995).png', ipdb: 2853 },
	{ bg: 'Johnny Mnemonic (Williams 1995).png', logo: 'Johnny Mnemonic (Williams 1995).png', ipdb: 3683 },
	{ bg: 'Judge Dredd (Midway 1993).png', logo: 'Judge Dredd (Midway 1993).png', ipdb: 1322 },
	{ bg: null, logo: 'Junk Yard (Williams 1996) Wheel.png', ipdb: 4014 },
	{ bg: 'Jurassic Park (Data East 1993).png', logo: 'Jurassic Park (Data East 1993).png', ipdb: 1343 },
	{ bg: 'Lord Of The Rings (Stern 2003).png', logo: 'Lord Of The Rings (Stern 2003).png', ipdb: 4858 },
	{ bg: 'Medieval Madness (Williams 1997).png', logo: 'Medieval Madness (Williams 1997).png', ipdb: 4032 },
	{ bg: 'Monster Bash (Williams 1998).png', logo: 'Monster Bash (Williams 1998).png', ipdb: 4441 },
	{ bg: null, logo: 'Mousin Around (Bally 1989).png', ipdb: 1635 },
	{ bg: null, logo: 'No Good Gofers (Williams 1997).png', ipdb: 4338 },
	{ bg: null, logo: 'Party Zone (Bally 1991).png', ipdb: 1764 },
	{ bg: 'Red and Teds Road Show (Williams 1994).png', logo: 'Red and Teds Road Show (Williams 1994).png', ipdb: 1972 },
	{ bg: null, logo: 'Ripleys Believe It or Not (Stern 2004).png', ipdb: 4917 },
	{ bg: null, logo: 'Safe Cracker (Bally 1996).png', ipdb: 3782 },
	{ bg: null, logo: 'Scared Stiff (Williams 1996).png', ipdb: 3915 },
	{ bg: 'Spider-Man (Stern 2007).png', logo: 'Spider-Man (Stern 2007).png', ipdb: 5237 },
	{ bg: 'Star Wars (Data East 1992).png', logo: 'Star Wars (Data East 1992).png', ipdb: 2358 },
	{ bg: 'STTNG (Williams 1993).png', logo: 'STTNG (Williams 1993).png', ipdb: 2357 },
	{ bg: 'Tales from the Crypt (Data East 1993).png', logo: 'Tales from the Crypt (Data East 1993).png', ipdb: 2493 },
	{ bg: 'Tales of the Arabian Nights (Williams 1996).png', logo: 'Tales of the Arabian Nights (Williams 1996).png', ipdb: 3824 },
	{ bg: 'Terminator 2 - Judgment Day (Williams 1991).png', logo: 'Terminator 2 - Judgment Day (Williams 1991).png', ipdb: 2524 },
	{ bg: 'The Adams Family (Williams 1992).png', logo: 'The Adams Family (Williams 1992).png', ipdb: 20 },
	{ bg: 'The Shadow (Bally 1994).png', logo: 'The Shadow (Bally 1994).png', ipdb: 2528 },
	{ bg: 'The Simpsons Pinball Party (Stern 2003).png', logo: 'The Simpsons Pinball Party (Stern 2003).png', ipdb: 4674 },
	{ bg: 'Tommy The Pinball Wizard (Data East 1994).png', logo: 'Theatre of Magic (Midway 1995).png', ipdb: 2845 },
	{ bg: 'Tri Zone (Williams 1979).png', logo: 'Tri Zone (Williams 1979).png', ipdb: 2641 },
	{ bg: 'Twilight Zone (Bally 1993).png', logo: 'Twilight Zone (Bally 1993).png', ipdb: 2684 },
	{ bg: 'Whirlwind (Williams 1990).png', logo: 'Whirlwind (Williams 1990).png', ipdb: 2765 },
	{ bg: 'Whirlwind (Williams 1990).png', logo: 'Whitewater (Williams 1993).png', ipdb: 2768 },
	{ bg: null, logo: 'Who Dunnit (Bally 1995).png', ipdb: 3685 },
	{ bg: 'World Cup Soccer (Midway 1994).png', logo: 'World Cup Soccer (Midway 1994).png', ipdb: 2811 },
	{ bg: 'Xenon (Bally 1980).png', logo: 'Xenon (Bally 1980).png', ipdb: 2821 }

];