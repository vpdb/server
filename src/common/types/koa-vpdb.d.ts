import { Models } from './models';
import { Serializers } from './serializers';
import { User } from '../../users/user.type';

declare module 'koa' {

	interface Context {
		/**
		 * Reference to all our database models.
		 */
		models: Models;

		/**
		 * Reference to all serializers
		 */
		serializers: Serializers;

		state: {
			user: User
		}
	}
}
