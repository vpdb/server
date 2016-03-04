/**
 * Test server configuration file.
 */
module.exports = {

	vpdb: {
		api:        { protocol: 'http', hostname: 'localhost', port: 7357, pathname: '/api/v1', prefix: '' },
		storage: {
			'public': { path: './data/storage-test-public', api: { protocol: 'https', hostname: 'localhost', port: 7357, pathname: '/storage/public', prefix: '' } },
			'protected': { path: './data/storage-test-protected', api: { protocol: 'https', hostname: 'localhost', port: 7357, pathname: '/storage/v1', prefix: '' } }
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
				free:   { credits: 3, per: 'day', enableAppTokens: false, enableRealtime: false },
				subscribed: { credits: 50, per: 'day', enableAppTokens: true, enableRealtime: false },
				vip: { credits: 200, per: 'day', enableAppTokens: true, enableRealtime: true },
				unlimited: { unlimited: true, enableAppTokens: true, enableRealtime: true }
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
		pusher: { enabled: false, options: { } },
		passport: {
			google: { enabled: false, clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' },
			github: { enabled: true, clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' },
			ipboard: [{ enabled: true, id: 'ipbtest', name: 'Test', icon: '', baseURL: 'https://vpdb.io/forums/index.php', clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' }]
		}
	}
	//, ffmpeg: { path: 'C:\\Development\\ffmpeg\\bin\\ffmpeg.exe' }
};