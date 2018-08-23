import { resolve } from 'path';
import { readFileSync } from 'fs';
import Axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

import { UploadConfig } from '../../../src/scripts/upload-data';

export async function uploadGames(config: UploadConfig) {

	const ipdb = require('../../ipdb.json');
	console.log('Local index with %d entries loaded.', ipdb.length);

	const apiConfig: AxiosRequestConfig = { baseURL: config.apiUri, headers: { 'Content-Type': 'application/json' } }
	const storageConfig: AxiosRequestConfig = { baseURL: config.storageUri, headers: {} }

	if (config.httpSimple) {
		const httpSimple = 'Basic ' + new Buffer(config.httpSimple.username + ':' + config.httpSimple.password).toString('base64');
		apiConfig.headers.Authorization = httpSimple;
		storageConfig.headers.Authorization = httpSimple;
	}

	let apiClient: AxiosInstance = Axios.create(apiConfig);
	let storageClient: AxiosInstance = Axios.create(storageConfig);

	// login
	console.log('Authenticating with user %s...', config.credentials.username)
	let res = await apiClient.post('/v1/authenticate', config.credentials);
	if (res.status != 200) {
		throw new Error('Error authenticating (' + res.status + '): ' + JSON.stringify(res.data));
	}
	if (!res.data.user.roles.includes('contributor')) {
		throw new Error('Must be contributor in order to add games!');
	}
	if (!res.data.token) {
		throw new Error('Could not retrieve token.');
	}

	// update clients with token
	apiConfig.headers[config.authHeader] = `Bearer ${res.data.token}`;
	storageConfig.headers[config.authHeader] = `Bearer ${res.data.token}`;
	apiClient = Axios.create(apiConfig);
	storageClient = Axios.create(storageConfig);

	// setup paths
	const bgFolder = resolve(config.folder, 'backglass');
	const logoFolder = resolve(config.folder, 'logo');
	console.log('Reading backglasses from %s.', bgFolder);
	console.log('Reading logos from %s.', logoFolder);

	for (const localData of data) {

		// read metadata from index
		const ipdbGame = ipdb.find((g: any) => g.ipdb.number === localData.ipdb);
		if (!ipdbGame) {
			console.warn('No game in local index found with IPDB# %s.', localData.ipdb);
			continue;
		}
		if (!localData.bg || !localData.logo) {
			console.log('Skipping "%s" due to incomplete media.', ipdbGame.title);
			continue;
		}
		console.log('Adding game "%s"...', ipdbGame.title);

		// upload background
		const bg = readFileSync(resolve(bgFolder, localData.bg));
		res = await storageClient.post('/v1/files', bg, {
			headers: {
				'Content-Disposition': 'attachment; filename="' + localData.bg + '"',
				'Content-Length': bg.length,
				'Content-Type': 'image/png'
			},
			params: { type: 'backglass' }
		});
		const bgRef = res.data.id;

		// upload logo
		const logo = readFileSync(resolve(logoFolder, localData.logo));
		res = await storageClient.post('/v1/files', bg, {
			headers: {
				'Content-Disposition': 'attachment; filename="' + localData.logo + '"',
				'Content-Length': logo.length,
				'Content-Type': 'image/png'
			},
			params: { type: 'logo' }
		});
		const logoRef = res.data.id;

		// complete data
		if (localData.id) {
			ipdbGame.id = localData.id;
		} else if (ipdbGame.short) {
			ipdbGame.id = ipdbGame.short[0].replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
		} else {
			ipdbGame.id = ipdbGame.title.replace(/[^a-z0-9\s\-]+/gi, '').replace(/\s+/g, '-').toLowerCase();
		}
		if (localData.title) {
			ipdbGame.title = ipdbGame.title;
		}
		ipdbGame.keywords = localData.keywords;
		ipdbGame.year = ipdbGame.year || localData.year || 1900;
		ipdbGame.game_type = ipdbGame.game_type || 'na';
		ipdbGame.manufacturer = ipdbGame.manufacturer || 'unknown';
		ipdbGame._backglass = bgRef;
		ipdbGame._logo = logoRef;

		res = await apiClient.post('/v1/games', ipdbGame);
		if (res.headers['x-token-refresh']) {
			apiConfig.headers[config.authHeader] = `Bearer ${res.headers['x-token-refresh']}`;
			storageConfig.headers[config.authHeader] = `Bearer ${res.headers['x-token-refresh']}`;
			apiClient = Axios.create(apiConfig);
			storageClient = Axios.create(storageConfig);
		}
	}
	console.log('done!');
}

const data: LocalData[] = [
	{ bg: 'Abra Ca Dabra (Gottlieb 1975).png', logo: 'Abra Ca Dabra (Gottlieb 1975).png', ipdb: 2, keywords: [ 'magic', 'shazam', 'trickery', 'poof', 'hocus pocus', 'wizardry' ] },
	{ bg: 'Aladdin\'s Castle (Bally 1976).png', logo: 'Aladdin\'s Castle (Bally 1976).png', ipdb: 40, keywords: [ 'night', 'genie', 'lamp', 'boy' ] },
	{ bg: 'Alien Star (Gottlieb 1984).png', logo: 'Alien Star (Gottlieb 1984).png', ipdb: 49, keywords: [ 'battle', 'world', 'journey' ] },
	{ bg: 'Amazing Spiderman (Gottlieb 1980).png', logo: 'Amazing Spiderman (Gottlieb 1980).png', ipdb: 2285, id: 'amazing-spider-man' },
	{ bg: 'America\'s Most Haunted (Spooky 2014).png', logo: 'amh-wheel.png', ipdb: 6161, keywords: [ 'ghost', 'hell', 'phantom', 'demon', 'mystery', 'myth' ] },
	{ bg: 'Apollo 13 (Sega 1995).png', logo: 'Apollo 13 (Sega 1995).png', ipdb: 3592, keywords: [ 'spaceship', 'astronaut', 'moon' ] },
	{ bg: 'Attack from Mars (Bally 1995).png', logo: 'Attack from Mars (Bally 1995).png', ipdb: 3781, keywords: [ 'martian', 'moon', 'saucer', 'invasion' ] },
	{ bg: 'Austin Powers (Stern 2001).png', logo: 'Austin Powers (Stern 2001).png', ipdb: 4504, keywords: [ 'agent', 'spy', 'mojo', 'shag' ] },
	{ bg: 'Back to the Future (Data East 1990).png', logo: 'Back to the Future (Data East 1990).png', ipdb: 126, keywords: [ 'plutonium', 'time machine', 'past' ] },
	{ bg: 'Bad Cats (Williams 1989).png', logo: 'Bad Cats (Williams 1989).png', ipdb: 127, keywords: [ 'fur', 'kitten', 'purr', 'tiger', 'fishbowl' ] },
	{ bg: 'Banzai Run (Williams 1988).png', logo: 'Banzai Run (Williams 1988).png', ipdb: 175, id: 'banzai', keywords: [ 'bike', 'race', 'hill', 'stunt', 'rider', 'winner', 'challenge' ] },
	{ bg: 'Batman (Data East 1991).png', logo: 'Batman (Data East 1991).png', ipdb: 195, keywords: [ 'joker', 'gotham', 'cave', 'butler' ] },
	{ bg: 'Baywatch (Sega 1995).png', logo: 'Baywatch (Sega 1995).png', ipdb: 2848, keywords: [ 'lifeguard', 'ocean', 'shark', 'drama', 'slowmo' ] },
	{ bg: 'Big Bang Bar (Capcom 1996).png', logo: 'Big Bang Bar (Capcom 1996).png', ipdb: 4001, keywords: [ 'tube', 'moan', 'dancer', 'space', 'alien' ] },
	{ bg: 'Big Brave (Maresa 1974).png', logo: 'Big Brave (Maresa 1974).png', ipdb: 4634, year: 1974, keywords: [ 'indian', 'tipi', 'feather' ] },
	{ bg: 'Big Guns (Williams 1987).png', logo: 'Big Guns (Williams 1987).png', ipdb: 250, keywords: [ 'king', 'queen', 'galaxy', 'attack' ] },
	{ bg: 'Black Knight (Williams 1980).png', logo: 'Black Knight (Williams 1980).png', ipdb: 310, keywords: [ 'warrior', 'horse', 'horseman', 'lance' ] },
	{ bg: 'Black Knight 2000 (Williams 1989).png', logo: 'Black Knight 2000 (Williams 1989).png', ipdb: 311, keywords: [ 'warrior', 'horse', 'horseman', 'lance' ] },
	{ bg: 'Black Rose (Bally 1992).png', logo: 'Black Rose (Bally 1992).png', ipdb: 313, keywords: [ 'pirate', 'ship', 'cannon' ] },
	{ bg: 'Bone Busters (Gottlieb 1989).png', logo: 'Bone Busters (Gottlieb 1989).png', ipdb: 347 },
	{ bg: 'Bram Stokers Dracula (Williams 1993).png', logo: 'Bram Stokers Dracula (Williams 1993).png', ipdb: 3072, id: 'drac' },
	{ bg: 'Bride Of Pinbot (Williams 1991).png', logo: 'Bride Of Pinbot (Williams 1991).png', ipdb: 1502 },
	{ bg: 'Cactus Canyon (Midway 1998).png', logo: 'Cactus Canyon (Midway 1998).png', ipdb: 4445 },
	{ bg: 'Capt Fantastic (Bally 1976).png', logo: 'Capt Fantastic (Bally 1976).png', ipdb: 438 },
	{ bg: 'Centaur (Bally 1981).png', logo: 'Centaur (Bally 1981).png', ipdb: 476 },
	{ bg: 'Centigrade 37 (Gottlieb 1977).png', logo: 'Centigrade 37 (Gottlieb 1977).png', ipdb: 480 },
	{ bg: 'Circus (Gottlieb 1980).png', logo: 'Circus (Gottlieb 1980).png', ipdb: 515 },
	{ bg: 'Cirqus Voltaire Night Mod (Bally 1997).png', logo: 'Cirqus Voltaire (Bally 1997).png', ipdb: 4059 },
	{ bg: 'Congo (Williams 1995).png', logo: 'Congo (Williams 1995).png', ipdb: 3780 },
	{ bg: 'Cosmic Gunfight (Williams 1982).png', logo: 'Cosmic Gunfight (Williams 1982).png', ipdb: 571 },
	{ bg: 'Creature from the Black Lagoon (Bally 1992).png', logo: 'Creature from the Black Lagoon (Bally 1992).png', ipdb: 588 },
	{ bg: 'Cyclone (Williams 1981).png', logo: 'Cyclone (Williams 1981).png', ipdb: 617 },
	{ bg: 'Demolition Man (Williams 1994).png', logo: 'Demolition Man (Williams 1994).png', ipdb: 662 },
	{ bg: 'Diner (Williams 1990).png', logo: 'Diner (Williams 1990).png', ipdb: 681 },
	{ bg: 'Doctor Who (Bally 1992).png', logo: 'Doctor Who (Bally 1992).png', ipdb: 738 },
	{ bg: 'Dungeons & Dragons (Bally 1987).png', logo: 'Dungeons & Dragons (Bally 1987).png', ipdb: 743, id: 'dnd' },
	{ bg: 'Dr Dude (Midway 1990).png', logo: 'Dr Dude (Midway 1990).png', ipdb: 737, id: 'dr-dude' },
	{ bg: 'Earthshaker (Williams 1989).png', logo: 'Earthshaker (Williams 1989).png', ipdb: 753 },
	{ bg: 'Eight Ball (Bally 1977).png', logo: 'Eight Ball (Bally 1977).png', ipdb: 760 },
	{ bg: 'Elvira and the Party Monsters (Bally 1995).png', logo: 'Elvira and the Party Monsters (Bally 1995).png', ipdb: 782 },
	{ bg: 'Elvis (Stern 2004).png', logo: 'Elvis (Stern 2004).png', ipdb: 4983, id: 'elvis' },
	{ bg: 'F-14 Tomcat (Williams 1987).png', logo: 'F-14 Tomcat (Williams 1987).png', ipdb: 804 },
	{ bg: 'Farfalla (Zaccharia 1983).png', logo: 'Farfalla (Zaccharia 1983).png', ipdb: 824 },
	{ bg: 'FirePower (Williams 1980).png', logo: 'FirePower (Williams 1980).png', ipdb: 856 },
	{ bg: 'Fish Tales (Williams 1992).png', logo: 'Fish Tales (Williams 1992).png', ipdb: 861 },
	{ bg: 'Flash Gordon (Bally 1981).png', logo: 'Flash Gordon (Bally 1981).png', ipdb: 874 },
	{ bg: 'Flight 2000 (Stern 1980).png', logo: 'Flight 2000 (Stern 1980).png', ipdb: 887 },
	{ bg: 'Flintstones, The (Williams 1994).png', logo: 'Flintstones (Williams 1994).png', ipdb: 888 },
	{ bg: 'Frankenstein (Sega 1995).png', logo: 'Frankenstein (Sega 1995).png', ipdb: 947 },
	{ bg: 'Funhouse (Williams 1990).png', logo: 'Funhouse (Williams 1990).png', ipdb: 966 },
	{ bg: 'Genie (Gottlieb 1979).png', logo: 'Genie (Gottlieb 1979).png', ipdb: 997 },
	{ bg: 'Getaway - High Speed II (Williams 1992).png', logo: 'Getaway - High Speed II (Williams 1992).png', ipdb: 1000 },
	{ bg: 'Gilligans Island (Williams 1991).png', logo: 'Gilligans Island (Midway 1991).png', ipdb: 1004 },
	{ bg: 'Goldeneye (Sega 1996).png', logo: 'Goldeneye (Sega 1996).png', ipdb: 3792 },
	{ bg: 'Gorgar (Williams 1979).png', logo: 'Gorgar (Williams 1979).png', ipdb: 1062 },
	{ bg: 'Grand Lizard (Williams 1986).png', logo: 'Grand Lizard (Williams 1986).png', ipdb: 1070 },
	{ bg: 'Guns and Roses (Data East 1994).png', logo: 'Guns and Roses (Data East 1994).png', ipdb: 1100 },
	{ bg: 'Haunted House (Gottlieb 1982).png', logo: 'Haunted House (Gottlieb 1982).png', ipdb: 1133 },
	{ bg: 'Heavy Metal Meltdown (Bally 1987).png', logo: 'Heavy Metal Meltdown (Bally 1987).png', ipdb: 1150 },
	{ bg: 'High Speed (Williams 1986).png', logo: 'High Speed (Williams 1986).png', ipdb: 1176 },
	{ bg: 'Hurricane (Williams 1991).png', logo: 'Hurricane (Williams 1991).png', ipdb: 1257 },
	{ bg: 'Independence Day (Sega 1996).png', logo: 'Independence Day (Sega 1996).png', ipdb: 3878 },
	{ bg: 'Indiana Jones (Williams 1993).png', logo: 'Indiana Jones (Williams 1993).png', ipdb: 1267 },
	{ bg: 'Indianapolis 500 (Midway 1995).png', logo: 'Indianapolis 500 (Midway 1995).png', ipdb: 2853, id: 'i500' },
	{ bg: 'Iron Balls (Stargame 1987).png', logo: 'Iron Balls (Stargame 1987).png', ipdb: 4426 },
	{ bg: 'Jack-Bot (Williams 1995).png', logo: 'Jack-Bot (Williams 1995).png', ipdb: 3619 },
	{ bg: 'Johnny Mnemonic (Williams 1995).png', logo: 'Johnny Mnemonic (Williams 1995).png', ipdb: 3683 },
	{ bg: 'Jokerz (Williams 1988).png', logo: 'Jokerz (Williams 1988).png', ipdb: 1308 },
	{ bg: 'Judge Dredd (Midway 1993).png', logo: 'Judge Dredd (Midway 1993).png', ipdb: 1322 },
	{ bg: 'Junk Yard (Williams 1996).png', logo: 'Junk Yard (Williams 1996) Wheel.png', ipdb: 4014 },
	{ bg: 'Jurassic Park (Data East 1993).png', logo: 'Jurassic Park (Data East 1993).png', ipdb: 1343 },
	{ bg: 'Kiss (Bally 1978).png', logo: 'KISS (Bally 1979).png', ipdb: 1386, id: 'kiss-bally' },
	{ bg: 'Last Action Hero (Data East 1993).png', logo: 'Last Action Hero (Data East 1993).png', ipdb: 1416 },
	{ bg: 'Lethal Weapon 3 (Data East 1992).png', logo: 'Lethal Weapon 3 (Data East 1992).png', ipdb: 1433 },
	{ bg: 'Lord Of The Rings (Stern 2003).png', logo: 'Lord Of The Rings (Stern 2003).png', ipdb: 4858 },
	{ bg: 'Maverick (Data East 1994).png', logo: 'Maverick (Data East 1994).png', ipdb: 1561, id: 'mav' },
	{ bg: 'Medieval Madness (Williams 1997).png', logo: 'Medieval Madness (Williams 1997).png', ipdb: 4032 },
	{ bg: 'Monopoly (Stern 2001).png', logo: 'Monopoly (Stern 2001).png', ipdb: 4505 },
	{ bg: 'Monster Bash (Williams 1998).png', logo: 'Monster Bash (Williams 1998).png', ipdb: 4441 },
	{ bg: 'Mousin Around (Bally 1989).png', logo: 'Mousin Around (Bally 1989).png', ipdb: 1635 },
	{ bg: 'Mr. & Mrs. Pac-Man (Bally 1982).png', logo: 'Mr. & Mrs. Pac-Man (Bally 1982).png', ipdb: 1639 },
	{ bg: 'NBA Fastbreak (Midway 1997).png', logo: 'NBA Fastbreak (Midway 1997).png', ipdb: 4023 },
	{ bg: 'No Fear (Williams 1995).png', logo: 'No Fear (Williams 1995).png', ipdb: 2852 },
	{ bg: 'No Good Gofers (Williams 1997).png', logo: 'No Good Gofers (Williams 1997).png', ipdb: 4338 },
	{ bg: 'Party Zone (Williams 1991).png', logo: 'Party Zone (Bally 1991).png', ipdb: 1764 },
	{ bg: 'Pinball Champ (Zaccaria 1982).png', logo: 'Pinball Champ (Zaccaria 1982).png', ipdb: 1793 },
	{ bg: 'Pinball Magic (Capcom 1995).png', logo: 'Pinball Magic (Capcom 1995).png', ipdb: 3596 },
	{ bg: 'PinBot (Williams 1986).png', logo: 'PinBot (Williams 1986).png', ipdb: 1796 },
	{ bg: 'Playboy (Bally 1978).png', logo: 'Playboy (Bally 1978).png', ipdb: 1823, id: 'playboy-bally' },
	{ bg: 'Playboy (Stern 2002).png', logo: 'Playboy (Stern 2002).png', ipdb: 4506, id: 'playboy-stern' },
	{ bg: 'Panthera (Bally 1980).png', logo: 'Panthera (Gottlieb 1980).png', ipdb: 1745 },
	{ bg: 'Popeye Saves the Earth (Williams 1994).png', logo: 'Popeye Saves the Earth (Williams 1994).png', ipdb: 1851, id: 'popeye' },
	{ bg: 'Red and Teds Road Show (Williams 1994).png', logo: 'Red and Teds Road Show (Williams 1994).png', ipdb: 1972 },
	{ bg: 'Ripleys Believe It or Not (Stern 2004).png', logo: 'Ripleys Believe It or Not (Stern 2004).png', ipdb: 4917 },
	{ bg: 'RollerCoaster Tycoon (Stern 2002).png', logo: 'RollerCoaster Tycoon (Stern 2002).png', ipdb: 4536 },
	{ bg: 'Safe Cracker (Bally 1996).png', logo: 'Safe Cracker (Bally 1996).png', ipdb: 3782 },
	{ bg: 'Scared Stiff (Williams 1996).png', logo: 'Scared Stiff (Williams 1996).png', ipdb: 3915 },
	{ bg: 'South Park (Sega 1999).png', logo: 'South Park (Sega 1999).png', ipdb: 4444 },
	{ bg: 'Spider-Man (Stern 2007).png', logo: 'Spider-Man (Stern 2007).png', ipdb: 5237 },
	{ bg: 'Starship Troopers (Sega 1997).png', logo: 'Starship Troopers (Sega 1997).png', ipdb: 4341 },
	{ bg: 'Star Wars (Data East 1992).png', logo: 'Star Wars (Data East 1992).png', ipdb: 2358 },
	{ bg: 'Star Trek (Bally 1979).png', logo: 'Star Trek (Bally 1978).png', ipdb: 2355 },
	{ bg: 'STTNG (Williams 1993).png', logo: 'STTNG (Williams 1993).png', ipdb: 2357 },
	{ bg: 'Super Mario Bros (Premier 1992).png', logo: 'Super Mario Bros (Premier 1992).png', ipdb: 2435, id: 'smb' },
	{ bg: 'Superman (Atari 1979).png', logo: 'Superman (Atari 1979).png', ipdb: 2454 },
	{ bg: 'Tales from the Crypt (Data East 1993).png', logo: 'Tales from the Crypt (Data East 1993).png', ipdb: 2493 },
	{ bg: 'Tales of the Arabian Nights (Williams 1996).png', logo: 'Tales of the Arabian Nights (Williams 1996).png', ipdb: 3824 },
	{ bg: 'Teenage Mutant Ninja Turtles (Data East 1991).png', logo: 'Teenage Mutant Ninja Turtles (Data East 1991).png', ipdb: 2509 },
	{ bg: 'Terminator 2 - Judgment Day (Williams 1991).png', logo: 'Terminator 2 - Judgment Day (Williams 1991).png', ipdb: 2524 },
	{ bg: 'Terminator 3 (Stern 2003).png', logo: 'Terminator 3 (Stern 2003).png', ipdb: 4787 },
	{ bg: 'The Adams Family (Williams 1992).png', logo: 'The Adams Family (Williams 1992).png', ipdb: 20 },
	{ bg: 'The Incredible Hulk (Gottlieb 1979).png', logo: 'The Incredible Hulk (Gottlieb 1979).png', ipdb: 1266 },
	{ bg: 'The Shadow (Bally 1994).png', logo: 'The Shadow (Bally 1994).png', ipdb: 2528 },
	{ bg: 'The Simpsons Pinball Party (Stern 2003).png', logo: 'The Simpsons Pinball Party (Stern 2003).png', ipdb: 4674 },
	{ bg: 'The Sopranos (Stern 2005).png', logo: 'The Sopranos(Stern 2005).png', ipdb: 5053, id: 'sopranos' },
	{ bg: 'Theatre of Magic (Midway 1995).png', logo: 'Theatre of Magic (Midway 1995).png', ipdb: 2845 },
	{ bg: 'Tommy The Pinball Wizard (Data East 1994).png', logo: 'Tommy The Pinball Wizard (Data East 1994).png', ipdb: 2579 },
	{ bg: 'Torpedo Alley (Data East 1988).png', logo: 'Torpedo Alley (Data East 1988).png', ipdb: 2603 },
	{ bg: 'TRON Legacy (Stern 2011).png', logo: 'TRON Legacy (Stern 2011).png', ipdb: 5682 , title: 'TRON Legacy', id: 'tron' },
	{ bg: 'Tri Zone (Williams 1979).png', logo: 'Tri Zone (Williams 1979).png', ipdb: 2641 },
	{ bg: 'Twilight Zone (Bally 1993).png', logo: 'Twilight Zone (Bally 1993).png', ipdb: 2684 },
	{ bg: 'Twister (Sega 1996).png', logo: 'Twister (Sega 1996).png', ipdb: 3976 },
	{ bg: 'Whirlwind (Williams 1990).png', logo: 'Whirlwind (Williams 1990).png', ipdb: 2765, id: 'whirlwind' },
	{ bg: 'Whitewater (Williams 1993).png', logo: 'Whitewater (Williams 1993).png', ipdb: 2768, id: 'whitewater' },
	{ bg: 'Who Dunnit (Bally 1995).png', logo: 'Who Dunnit (Bally 1995).png', ipdb: 3685 },
	{ bg: 'World Cup Soccer (Midway 1994).png', logo: 'World Cup Soccer (Midway 1994).png', ipdb: 2811 },
	{ bg: 'Xenon (Bally 1980).png', logo: 'Xenon (Bally 1980).png', ipdb: 2821 }
];

interface LocalData {
	id?: string;
	title?: string;
	bg: string;
	logo: string;
	ipdb: number;
	year?: number;
	keywords?: string[];
}