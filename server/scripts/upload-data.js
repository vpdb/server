
var games = require('./../../data/gen/games/games');

var local = {
	apiUri: 'http://localhost:3000/api/v1',
	storageUri: 'http://localhost:3000/storage/v1',
	authHeader: 'Authorization',
	credentials: { username: 'test', password: 'xxxxxx' }
};
var staging = {
	apiUri: 'https://staging.vpdb.ch/api/v1',
	storageUri: 'https://staging.vpdb.ch/storage/v1',
	authHeader: 'X-Authorization',
	credentials: { username: 'test', password: 'xxxxxx' }
};
games.upload(local);

