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
				year: 1995
			},
			{
				id: 'Big Bang Bar (Capcom 1996)',
				name: 'Big Bang Bar',
				manufacturer: 'Capcom',
				year: 1996
			},
			{
				id: 'Black Rose (Bally 1992)',
				name: 'Black Rose',
				manufacturer: 'Bally',
				year: 1992
			},
			{
				id: 'Cactus Canyon (Midway 1998)',
				name: 'Cactus Canyon',
				manufacturer: 'Midway',
				year: 1998
			},
			{
				id: 'Cirqus Voltaire (Bally 1997)',
				name: 'Cirqus Voltaire',
				manufacturer: 'Bally',
				year: 1997
			},
			{
				id: 'Centaur (Bally 1981)',
				name: 'Centaur',
				manufacturer: 'Bally',
				year: 1981
			},
			{
				id: 'Terminator 2 - Judgment Day (Williams 1991)',
				name: 'Terminator 2 - Judgment Day',
				manufacturer: 'Williams',
				year: 1991
			},
			{
				id: 'The Adams Family (Williams 1992)',
				name: 'The Addams Family',
				manufacturer: 'Williams',
				year: 1992
			},
			{
				id: 'Who Dunnit (Bally 1995)',
				name: 'Who Dunnit',
				manufacturer: 'Bally',
				year: 1995
			}
		]
	});
};