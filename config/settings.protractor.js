/**
 * Test server configuration file.
 *
 * This is used when running tests locally with `npm run serve:protractor`.
 */
module.exports = {

	vpdb: {
		name: 'Test API',
		api: { protocol: 'http', hostname: 'localhost', port: 7357, pathname: '/api', prefix: '' },
		storage: {
			'public': { path: './data/storage-test-public', api: { protocol: 'http', hostname: 'localhost', port: 7357, pathname: '/storage/public', prefix: '' } },
			'protected': { path: './data/storage-test-protected', api: { protocol: 'http', hostname: 'localhost', port: 7357, pathname: '/storage', prefix: '' } }
		},
		webapp: { protocol: 'http', hostname: 'localhost', port: 3333 },
		db: `mongodb://localhost:${process.env.MONGODB_PORT || 27017}/vpdb-test`,
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
			console: { enabled: true, colored: true },
			file: { text: null, json: null },
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
		passport: {
			google: { enabled: false, clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' },
			github: { enabled: true, clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET' },
			ipboard: [{ enabled: true, id: 'ipbtest', name: 'Test', icon: '', baseURL: 'https://vpdb.io/forums/index.php', clientID: 'TEST_CLIENT_ID', clientSecret: 'TEST_CLIENT_SECRET', version: 3 }]
		},
		services: {
			raygun: { enabled: false, apiKey: '', tag: '' },
			rollbar: { enabled: false, apiKey: '', environment: '' },
		}
	},
	webapp: { ga: { enabled: false, id: '' } }
	//, ffmpeg: { path: 'E:\\Tools\\FFmpeg\\bin\\ffmpeg.exe' }
};