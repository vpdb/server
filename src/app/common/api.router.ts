import * as Router from 'koa-router';

export interface ApiRouter {

	getRouter(): Router;
	setupCache?(): void;
}
