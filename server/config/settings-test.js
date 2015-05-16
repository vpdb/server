/**
 * Test server configuration file.
 */
module.exports = {

	vpdb: {
		api:        { protocol: 'http', hostname: 'localhost', port: 7357, pathname: '/api/v1' },
		storage: {
			'public': { path: './data/storage-test-public', api: { protocol: 'https', hostname: 'localhost', port: 7357, pathname: '/storage/public' } },
			'protected': { path: './data/storage-test-protected', api: { protocol: 'https', hostname: 'localhost', port: 7357, pathname: '/storage/v1' } }
		},
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
		logging: {
			console: { access: true,  app: true },
			file: { access: null, app: null },
			papertrail: { access: false, app: false, options: { } }
		},
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
				'backglass': { category: { video: 1, image: 0 }, variation: -1 },
				'logo': { category: 0, variation: -1 },
				'playfield-fs': { category: { video: 1, image: 0 }, variation: -1 },
				'playfield-ws': { category: { video: 1, image: 0 }, variation: -1 },
				'release': { category: { table: 1, '*': 0 } },
				'rom': 0
			}
		},
		metrics: { bayesianEstimate: { minVotes: 3, globalMean: null } },
		tmp: '.',
		authorizationHeader: 'Authorization',
		generateTableScreenshot: false,
		passport: {
			github: { enabled: true, clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' },
			ipboard: [{ enabled: true, id: 'ipbtest', name: 'Test', icon: '', baseURL: 'https://vpdb.ch/forums/index.php', clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' }]
		}
	}
};