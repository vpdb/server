import Application from 'koa';
import koaLogger from 'koa-logger';
import koaBodyParser from 'koa-bodyparser';
import { EndPoint } from './common/types/endpoint';
import { Models } from './common/types/models';
import { Serializers } from './common/types/serializers';
import { config } from './common/settings'

export class Server {

	private app: Application;

	constructor() {
		this.app = new Application();
		this.app.use(koaLogger());
		this.app.use(koaBodyParser());

		this.app.context.models = {};
		this.app.context.serializers = {};
	}

	public register<T>(endPoint: EndPoint<T>) {
		// routes
		this.app.use(endPoint.getRouter().routes());
		this.app.use(endPoint.getRouter().allowedMethods());

		// model
		endPoint.registerModel(this.app.context.models);

		// serializer
		endPoint.registerSerializer(this.app.context.serializers);
	}

	public start() {
		console.log('Listening on port %s.', config.vpdb.api.port);
		this.app.listen(config.vpdb.api.port);
	}

	public models(): Models {
		return this.app.context.models;
	}

	public serializers(): Serializers {
		return this.app.context.serializers;
	}
}

export const server = new Server();