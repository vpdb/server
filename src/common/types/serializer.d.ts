import { Context } from 'koa';

export interface Serializer<T> {

	/**
	 * Returns the reduced version of the object.
	 *
	 * @param {Context} ctx Koa context
	 * @param {T} doc Retrieved MongoDB object
	 * @param {SerializerOptions} [opts] Additional options for serialization
	 * @return Promise<object> Serialized object
	 */
	reduced(ctx: Context, doc: T, opts: SerializerOptions): Promise<object>;

	/**
	 * Returns the simple version of the object.
	 *
	 * @param {Context} ctx Koa context
	 * @param {T} doc Retrieved MongoDB object
	 * @param {SerializerOptions} [opts] Additional options for serialization
	 * @return Promise<object> Serialized object
	 */
	simple(ctx: Context, doc: T, opts: SerializerOptions): Promise<object>;

	/**
	 * Returns the detailed version of the object.
	 *
	 * @param {Context} ctx Koa context
	 * @param {T} doc Retrieved MongoDB object
	 * @param {SerializerOptions} [opts] Additional options for serialization
	 * @return Promise<object> Serialized object
	 */
	detailed(ctx: Context, doc: T, opts: SerializerOptions): Promise<object>;
}

export interface SerializerOptions {
	includedFields?: string[],
	excludedFields?: string[],
	starred?: boolean | undefined,
	fileIds?: string[],
	thumbFlavor?: string
	thumbFormat?: string,
	fullThumbData?: boolean,
	thumbPerFile?: boolean,
	includeProviderId?: string
}