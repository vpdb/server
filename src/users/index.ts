import { Schema } from 'mongoose';
import mongoose = require('mongoose');
import Router from 'koa-router';

import { Models } from '../common/types/models';
import { Serializers } from '../common/types/serializers';
import { EndPoint } from '../common/types/endpoint';

import { User } from './user.type';
import { UserSerializer } from './user.serializer';
import { schema } from './user.schema';
import { router } from './user.api.router';

export class UserEndPoint implements EndPoint<User> {

	readonly name: string = 'users';

	private readonly _router: Router;
	private readonly _schema: Schema;

	constructor() {
		this._router = router;
		this._schema = schema;
	}

	getRouter(): Router {
		return this._router;
	}

	registerModel(models: Models) {
		models.user = mongoose.model<User>('User', this._schema);
	}

	registerSerializer(serializers: Serializers): void {
		serializers.user = new UserSerializer();
	}
}