var _ = require('underscore');

/*
 * Serve JSON to our AngularJS client
 */

var data = [
	{
		id: 'afm',
		key: 'Attack from Mars (Bally 1995)',
		name: 'Attack from Mars',
		manufacturer: 'Midway',
		year: 1995,
		ipdbno: 3781,
		rating: 8.2,
		votes: 18,
		views: 768,
		comments: 5,
		tabledownloads: 4098,
		lastrelease: '2014-03-23T20:38:20Z',
		authors: [ 'jpsalas' ],
		releases: [
			{
				id: 1198,
				title: 'AFM Lightning Edition',
				description: "Use these options to configure the table:\n\n    '******************************\n    ' SET alpha GI colors\n    '******************************\n    ' For NORMAL operation set\n    ' GION_alphaGIcolor = 1\n    ' GIOFF_alphaGIcolor = 0\n    \n    ' Or try some green martian lighting:\n    ' GIOn_alphaGIcolor = 2\n    ' GIOFF_alphaGIcolor = 3\n    \n    ' Or Mars red:\n    ' GIOn_alphaGIcolor = 3\n    ' GIOFF_alphaGIcolor = 0\n    \n    ' or disable feature by setting both values to 0\n    \n    GION_alphaGIcolor = 1 ' 0=OFF, 1=WHITE, 2=GREEN, 3 = RED\n    GIOFF_alphaGIcolor = 3 ' 0=OFF, 1=WHITE, 2=GREEN, 3 = RED\n    '********************************\n",
				acknowledgements: '* Thank you JP Salas for giving me permission to mod this table of yours. All credit goes to JP. Modding this table made me appreciate this table so much more.\n* Thank you to Teppotee and JimmyFingers. On the new 3-Way GI, the default settings are White `ON` and Red `OFF`. Play it first without changing anything, so you can see whats happening.',
				authors: [
					{
						author: {
							user: 'jpsalas',
							avatar: '/avatars/jpsalas.png'
						},
						roles: [ 'Original Table' ]
					}, {
						author: {
							user: 'Aaron James',
							avatar: '/avatars/aaronjames.jpg'
						},
						roles: [ 'Table Mod' ]
					}, {
						author: {
							user: 'teppotee',
							avatar: '/avatars/teppotee.png'
						},
						roles: [ 'GI' ]
					}
				],
				rating: 8.1,
				votes: 20,
				screenshots: [],
				mods: [],
				versions: [
					{
						version: '3.5',
						timestamp: '2013-12-30T19:42:20Z',
						size: 22023498,
						submitter: 'Aaron James',
						downloads: 3659,
						changes: '* Teppotee reworked the lighting to make it work with VP9.2 Big thanks!!! He really helped me on this because i couldn\'t figure some things out, and he saved me alot of time.\n* I then changed the layback/xy settings, and had to add one more wall to the left side to hide flasher artifacts. I did a minor physics tweak.'
					},
					{
						version: '3.1',
						timestamp: '2013-04-22T05:04:20Z',
						size: 16903345,
						submitter: 'Aaron James',
						downloads: 2978,
						changes: '* I increased the size/shape of the strobe light. It\'s more dramatic and intensive.\n* I changed the red wire metal ramps to dark green/yellow. I was getting tired of the red myself...lol'
					}
				],
				comments: [
					{
						id: 1234,
						author: {
							user: 'freezy',
							avatar: '/avatars/freezy.jpg'
						},
						timestamp: '2014-03-23T23:45:20Z',
						message: '## Markdown test\n\nA list:\n\n* first item\n* second item\n\nAnd here a quote:\n\n> Geee!\n'
					}
				],
				media: [
					{
						filename: 'afm35.jpg',
						src: '/cabinet/afm35.jpg',
						type: 'playfield-cabinet',
						version: '3.5',
						width: 1280,
						height: 1920,
						filesize: 3994043,
						format: 'image',
						tags: ['night']
					},
					{
						filename: 'Attack from Mars (Bally 1995).flv',
						type: 'playfield-cabinet',
						version: '3.5',
						width: 1280,
						height: 1920,
						filesize: 586292,
						duration: 120,
						format: 'video',
						tags: ['day']
					}
				],

				// easy acess fields:
				thumbs: {
					playfield: '/cabinet/afm35.jpg'
				},
				lastversion: {
					version: '3.5',
					timestamp: '2013-12-30T19:42:20Z',
					size: 22023498,
					submitter: 'Aaron James',
					downloads: 3659,
					changes: '* Teppotee reworked the lighting to make it work with VP9.2 Big thanks!!! He really helped me on this because i couldn\'t figure some things out, and he saved me alot of time.\n* I then changed the layback/xy settings, and had to add one more wall to the left side to hide flasher artifacts. I did a minor physics tweak.'
				}
			}
		],
		roms: [],
		media: []
	},
	{
		id: 'bbb',
		key: 'Big Bang Bar (Capcom 1996)',
		name: 'Big Bang Bar',
		manufacturer: 'Capcom',
		year: 1996,
		rating: 8.2,
		votes: 12,
		views: 	6932,
		comments: 16,
		tabledownloads: 2797,
		lastrelease: '2013-06-16T11:52:00Z',
		authors: [ 'unclewilly', 'jimmyfingers', 'Grizz' ]
	},
	{
		id: 'br',
		key: 'Black Rose (Bally 1992)',
		name: 'Black Rose',
		manufacturer: 'Bally',
		year: 1992,
		rating: 7.8,
		votes: 1,
		views: 3584,
		comments: 16,
		tabledownloads: 1339,
		lastrelease: '2009-07-23T10:03:00Z',
		authors: [ 'destruk' ]
	},
	{
		id: 'cc',
		key: 'Cactus Canyon (Midway 1998)',
		name: 'Cactus Canyon',
		manufacturer: 'Midway',
		year: 1998,
		rating: 8.5,
		votes: 14,
		views: 8179,
		comments: 7,
		tabledownloads: 3238,
		lastrelease: '2014-02-03T20:59:00Z',
		authors: [ 'Lord Hiryu', 'MRCMRC', 'Aaron James', 'thewool', 'unclewilly', 'Koadic', 'Sheltemke' ]
	},
	{
		id: 'cv',
		key: 'Cirqus Voltaire (Bally 1997)',
		name: 'Cirqus Voltaire',
		manufacturer: 'Bally',
		year: 1997,
		rating: 8.1,
		votes: 14,
		views: 	9473,
		comments: 31,
		tabledownloads: 3845,
		lastrelease: '2014-02-03T20:59:00Z',
		authors: [ 'JP Salas', 'Rosve', 'Aaron James', 'Teppotee', 'Koadic', 'Dozer316' ]
	},
	{
		id: 'centaur',
		key: 'Centaur (Bally 1981)',
		name: 'Centaur',
		manufacturer: 'Bally',
		year: 1981,
		rating: 9.1,
		votes: 5,
		views: 2440,
		comments: 12,
		tabledownloads: 915,
		lastrelease: '2013-07-14T21:46:00Z',
		authors: [ 'Fuzzel', 'Lord Hiryu' ]
	},
	{
		id: 'mb',
		key: 'Monster Bash (Williams 1998)',
		name: 'Monster Bash',
		manufacturer: 'Williams',
		year: 1998,
		ipdb: {
			no: 4441,
			rating: 8.4,
			votes: 221
		},
		rating: 8.8,
		votes: 21,
		views: 7615,
		comments: 10,
		tabledownloads: 5934,
		lastrelease: '2014-02-03T19:47:20Z',
		authors: [ 'unclewilly', 'randr' ],
		releases: [
			{
				id: 954,
				title: 'PC Killer Edition',
				description: '*This is the high poly full model edition.*\n\nChanges from prior version:\n\n* Complete rebuild of the table\n* Bumpers, targets, rubbers, pegs, brackets, wire ramps, bulbs, and all toys are now 3D mesh primitives\n* Full 8-step fading GI using alpha ramps\n* Ball momentum engine added with flipper tap code\n* Alpha flashers added\n',
				acknowledgements: '* Special thanks to @grizz for original playfield work\n* @jimmyfingers for his excellent physics code\n* @fuzzel and @toxie for their continued work on VP and additional feature additions',
				authors: [
					{
						author: {
							user: 'unclewilly',
							avatar: '/avatars/unclewilly.jpg'
						},
						roles: [ 'Playfield', 'Textures' ]
					}, {
						author: {
							user: 'randr',
							avatar: '/avatars/randr.jpg'
						},
						roles: [ '3D Models' ]
					}
				],
				submitter: {
					user: 'unclewilly',
					avatar: '/avatars/unclewilly.jpg'
				},
				rating: 9.5,
				votes: 25,
				screenshots: [],
				mods: [],
				versions: [
					{
						version: '2.1',
						timestamp: '2014-02-03T19:47:20Z',
						size: 175135975,
						downloads: 1087,
						changes: '* Reduced Texture sizes\n* Added DOF Option\n* Added Day Option which brightens the playfield\n* Fixed Rollover lights blocking inserts'
					},
					{
						version: '2.0',
						timestamp: '2014-01-29T22:01:00Z',
						size: 169033450,
						downloads: 568,
						changes: '*Initial version*'
					}
				],
				comments: [
					{
						id: 1234,
						author: {
							user: 'fuzzel',
							avatar: '/avatars/fuzzel.jpg'
						},
						timestamp: '2014-02-28T22:46:20Z',
						message: 'Hey I\'m the first to say WELL DONE! :D'
					}
				],
				media: [
					{
						filename: 'mb_pckiller.png',
						src: '/cabinet/mb_pckiller.png',
						type: 'playfield-cabinet',
						version: '2.1',
						width: 1280,
						height: 1920,
						filesize: 3627246,
						format: 'image',
						tags: ['day', 'flasher']
					},
					{
						filename: '#',
						type: 'playfield-cabinet',
						src: '#',
						version: '2.1',
						width: 1280,
						height: 1920,
						filesize: 843398,
						duration: 120,
						format: 'video',
						tags: ['day', 'attract mode']
					}
				],

				// easy acess fields:
				thumbs: {
					playfield: '/cabinet/mb_pckiller.png'
				},
				lastversion: {
					version: '2.1',
					timestamp: '2014-02-03T19:47:20Z',
					size: 175135975,
					downloads: 1087,
					changes: '* Reduced Texture sizes\n* Added DOF Option\n* Added Day Option which brightens the playfield\n* Fixed Rollover lights blocking inserts'
				}
			}
		],
		roms: [],
		media: []
	},
	{
		id: 't2',
		key: 'Terminator 2 - Judgment Day (Williams 1991)',
		name: 'Terminator 2: Judgment Day',
		manufacturer: 'Williams',
		year: 1991,
		rating: 9.8,
		votes: 42,
		views: 34026,
		comments: 65,
		tabledownloads: 8265,
		lastrelease: '2014-01-10T08:29:00Z',
		authors: [ 'Tipoto' ]
	},
	{
		id: 'taf',
		key: 'The Adams Family (Williams 1992)',
		name: 'The Addams Family',
		manufacturer: 'Williams',
		year: 1992,
		rating: 8.8,
		votes: 22,
		views: 23750,
		comments: 43,
		tabledownloads: 9428,
		lastrelease: '2011-11-06T05:25:00Z',
		authors: [ 'melon' ]
	},
	{
		id: 'whodunnit',
		key: 'Who Dunnit (Bally 1995)',
		name: 'Who Dunnit',
		manufacturer: 'Bally',
		year: 1995,
		rating: 7.6,
		votes: 1,
		views: 	5013,
		comments: 9,
		tabledownloads: 1934,
		lastrelease: '2011-11-06T05:25:00Z',
		authors: [ 'destruk', 'The Trout' ]
	}
];

exports.tables = function(req, res) {
	res.json({
		result: data
	});
};

exports.table = function(req, res) {
	res.json({
		result: _.find(data, function(table) {
			return table.id == req.params.id;
		})
	});
};