import Router from 'koa-router';
import { Models } from 'models.d.ts';
import { Serializers } from "./serializers";

/**
 * An API end point (or, more RESTful, a "resource") bundles all the
 * functionality implemented by each end point, notably:
 *
 *    - API routes
 *    - API controller
 *    - Database model
 *    - Entity type
 */
export interface EndPoint<T> {

	/**
	 * The name (plural) of the end point.
	 */
	readonly name: string;

	/**
	 * Returns the router containing all the routes of the end point.
	 * @return {Router}
	 */
	getRouter(): Router;

	/**
	 * Registers the end point's model with Mongoose.
	 * @param {Models} models
	 */
	registerModel(models: Models): void;

	/**
	 * Registers the end point's serializer.
	 * @param {Serializers} serializers
	 */
	registerSerializer(serializers: Serializers): void;
}