/**
 * Test server configuration file.
 */
module.exports = {

	vpdb: {
		api: { host: 'localhost', port: 7357, scheme: 'http', path: '/api/v1', storagePath: '/storage/v1' },
		webapp: { host: 'localhost', port: 7357, scheme: 'http' },
		db: 'mongodb://localhost/vpdb-test',
		redis: { host: '127.0.0.1', port: 6379, db: 7 },
		sessionTimeout: 3600000,
		secret: 'do-not-run-this-config-in-production!',
		storage: './data/storage-test',
		skipImageOptimizations: true,
		quota: {
			plans: {
				free:   { credits: 5, per: 'day' },
				bronze: { credits: 50, per: 'day' },
				silver: { credits: 200, per: 'day' },
				gold:   { credits: 5000, per: 'day' },
				unlimited: { unlimited: true }
			},
			defaultPlan: 'free',
			costs: {
				'image/jpeg': 0,
				'image/png': 0,
				'application/zip': 1,
				'application/x-visual-pinball-table': 1,
				'video/mp4': 1,
				'video/x-flv': 1
			}
		},
		tmp: '.',
		authorizationHeader: 'Authorization',
		passport: {
			github: { enabled: true, clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' },
			ipboard: [{ enabled: true, id: 'ipbtest', name: 'Test', icon: '', baseURL: 'https://vpdb.ch/forums/index.php', clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' }]
		}
	}
};