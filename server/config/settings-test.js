/**
 * Test server configuration file.
 */
module.exports = {

	vpdb: {
		api:        { protocol: 'http', hostname: 'localhost', port: 7357, pathname: '/api/v1' },
		storageApi: { protocol: 'http', hostname: 'localhost', port: 7357, pathname: '/storage/v1' },
		webapp:     { protocol: 'http', hostname: 'localhost', port: 7357 },
		db: 'mongodb://localhost/vpdb-test',
		redis: { host: '127.0.0.1', port: 6379, db: 7 },
		apiTokenLifetime: 3600000,
		storageTokenLifetime: 60000,
		secret: 'do-not-run-this-config-in-production!',
		email: {
			confirmUserEmail: true,
			sender: { email: 'server@vpdb.local', name: 'VPDB Server' },
			nodemailer: {}
		},
		storage: './data/storage-test',
		skipImageOptimizations: true,
		quota: {
			plans: {
				free:   { credits: 3, per: 'day' },
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
		metrics: { bayesianEstimate: { minVotes: 3, globalMean: null } },
		tmp: '.',
		authorizationHeader: 'Authorization',
		passport: {
			github: { enabled: true, clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' },
			ipboard: [{ enabled: true, id: 'ipbtest', name: 'Test', icon: '', baseURL: 'https://vpdb.ch/forums/index.php', clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' }]
		}
	}
};