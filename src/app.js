const Koa = require('koa');
const koaLogger = require('koa-logger');
const koaBodyParser = require('koa-bodyparser');

const mongoose = require('mongoose');

const logger = require('./common/logger');
const users = require('./users');
const settings = require('./common/settings');

const modules = [ users ];

(async () => {
	try {
		const app = new Koa();
		app.use(koaLogger());
		app.use(koaBodyParser());

		logger.info('Connecting to MongoDB...');
		await mongoose.connect(settings.current.vpdb.db);

		logger.info('Creating modules...');
		for (let module of modules) {
			app.use(module.router.routes()).use(module.router.allowedMethods());
		}

		logger.info('Listening on port %s.', settings.current.vpdb.api.port);
		app.listen(settings.current.vpdb.api.port);

	} catch (err) {
		logger.error(err);
	}
})();
