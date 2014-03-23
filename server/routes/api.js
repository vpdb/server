/*
 * Serve JSON to our AngularJS client
 */

exports.name = function (req, res) {
  res.json({
    name: 'Bob'
  });
};

exports.tables = function (req, res) {
	res.json({
		result: [
			{
				id: 'Attack from Mars (Bally 1995)',
				name: 'Attack from Mars',
				manufacturer: 'Midway',
				year: 1995,
				rating: 8.2,
				votes: 18,
				views: 768,
				comments: 5,
				tabledownloads: 354,
				lastrelease: '2014-03-23T20:38:20Z',
				authors: [ 'JPSalas' ]
			},
			{
				id: 'Big Bang Bar (Capcom 1996)',
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
				id: 'Black Rose (Bally 1992)',
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
				id: 'Cactus Canyon (Midway 1998)',
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
				id: 'Cirqus Voltaire (Bally 1997)',
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
				id: 'Centaur (Bally 1981)',
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
				id: 'Terminator 2 - Judgment Day (Williams 1991)',
				name: 'Terminator 2 - Judgment Day',
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
				id: 'The Adams Family (Williams 1992)',
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
				id: 'Who Dunnit (Bally 1995)',
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
		]
	});
};