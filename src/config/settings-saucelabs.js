/**
 * Test server configuration file.
 */
module.exports = {

	vpdb: {
		name: 'Test API',
		api: { protocol: 'http', hostname: 'localhost', port: 4445, pathname: '/api/v1', prefix: '' },
		storage: {
			'public': { path: './data/storage-test-public', api: { protocol: 'http', hostname: 'localhost', port: 4445, pathname: '/storage/public', prefix: '' } },
			'protected': { path: './data/storage-test-protected', api: { protocol: 'http', hostname: 'localhost', port: 4445, pathname: '/storage/v1', prefix: '' } }
		},
		webapp: { protocol: 'http', hostname: 'localhost', port: 4445 },
		db: 'mongodb://localhost/vpdb-sauce',
		redis: { host: '127.0.0.1', port: 6379, db: 7 },
		apiTokenLifetime: 3600000,
		storageTokenLifetime: 60000,
		secret: 'do-not-run-this-config-in-production!',
		loginBackoff: { delay: [ 0 ], keep: 0 },
		email: {
			confirmUserEmail: false,
			sender: { email: 'server@vpdb.local', name: 'VPDB Server' },
			nodemailer: {}
		},
		logging: {
			level: 'info',
			console: { access: true,  app: true },
			file: { access: null, app: null },
			papertrail: { access: false, app: false, options: { } }
		},
		skipImageOptimizations: true,
		quota: {
			plans: [
				{ id: 'free', credits: 3, per: 'day', enableAppTokens: false, enableRealtime: false },
				{ id: 'subscribed', credits: 50, per: 'day', enableAppTokens: true, enableRealtime: false },
				{ id: 'vip', credits: 200, per: 'day', enableAppTokens: true, enableRealtime: true },
				{ id: 'unlimited', unlimited: true, enableAppTokens: true, enableRealtime: true }
			],
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
		restrictions: { release: { denyMpu: [ 9999 ] }, backglass: { denyMpu: [ 9999 ] }, rom: { denyMpu: [ 9999 ] } },
		tmp: '.',
		authorizationHeader: 'Authorization',
		generateTableScreenshot: false,
		pusher: { enabled: false, options: { } },
		passport: {
			google: { enabled: false, clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' },
			github: { enabled: false, clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' },
			ipboard: [{ enabled: true, id: 'ipbtest', name: 'Test', icon: '', baseURL: 'https://vpdb.io/forums/index.php', clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET', version: 3 }]
		}
	},
	webapp: { ga: { enabled: false, id: '' } }
};