import { Models } from './models';
import { Serializers } from './serializers';

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
	}
}
