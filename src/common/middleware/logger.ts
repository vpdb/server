import bytes = require('bytes');
import chalk, { Chalk, ColorSupport } from 'chalk';

import { Context } from '../types/context';
import { logger } from '../logger';

const Counter = require('passthrough-counter');

const statusStyle: { [key: number]: Chalk & { supportsColor: ColorSupport } } = {
	100: chalk.black.bgWhiteBright,
	200: chalk.black.bgGreenBright,
	300: chalk.black.bgCyanBright,
	400: chalk.black.bgYellowBright,
	500: chalk.black.bgRedBright
};

const methodStyle: { [key: string]: Chalk & { supportsColor: ColorSupport } } = {
	GET: chalk.white.bgBlue,
	HEAD: chalk.white.bgWhite,
	POST: chalk.white.bgGreen,
	PUT: chalk.white.bgBlue,
	DELETE: chalk.white.bgBlue,
	CONNECT: chalk.white.bgBlue,
	OPTIONS: chalk.white.bgBlue,
	TRACE: chalk.white.bgBlue,
	PATCH: chalk.white.bgBlue,
};

/**
 * Logs one-liners for each request.
 * Loosely based on https://github.com/koajs/logger/blob/master/index.js
 *
 * @return {(ctx: Context, next: () => Promise<any>) => Promise<void>}
 */
export function koaLogger() {

	return async function logger(ctx: Context, next: () => Promise<any>) {
		const start = Date.now();
		try {
			await next();
		} catch (err) {
			// log uncaught downstream errors
			log(ctx, start, null, err);
			throw err;
		}

		// calculate the length of a streaming response
		// by intercepting the stream with a counter.
		// only necessary if a content-length header is currently not set.
		const length = ctx.response.length;
		const body = ctx.body;
		let counter: { length: number };
		if (length == null && body && body.readable) {
			ctx.body = body.pipe(counter = Counter()).on('error', ctx.onerror);
		}

		// log when the response is finished or closed,
		// whichever happens first.
		const res = ctx.res;

		const onFinish = done.bind(null, 'finish');
		const onClose = done.bind(null, 'close');

		res.once('finish', onFinish);
		res.once('close', onClose);

		function done(event: string) {
			res.removeListener('finish', onFinish);
			res.removeListener('close', onClose);
			log(ctx, start, counter ? counter.length : length, null, event);
		}
	}
}

function log(ctx: Context, start: number, len: number, err: any = null, event: string = null) {

	const statusCode = err
		? (err.statusCode || err.status || 500)
		: (ctx.status || 404);
	let length;
	if (~[204, 205, 304].indexOf(statusCode)) {
		length = '';
	} else if (len == null) {
		length = '-';
	} else {
		length = bytes(len).toLowerCase();
	}

	const ip = ctx.request.get('x-forwarded-for') || ctx.ip || '0.0.0.0';
	const user = ctx.state.user ? ctx.state.user.name || ctx.state.user.username : '';
	let logUserIp: string;
	if (user) {
		logUserIp = chalk.cyan(user) + ':' + chalk.blueBright(ip);
	} else {
		logUserIp = chalk.blueBright(ip);
	}

	const upstream = err ? chalk.redBright('*ERR* ') : event === 'close' ? chalk.yellowBright('*CLOSED* ') : '';

	const logStatus = statusStyle[Math.floor(statusCode / 100) * 100] || statusStyle[100];
	const logMethod = methodStyle[ctx.method] || methodStyle.GET;

	if (statusCode >= 500 && statusCode < 600) {
		logger.error('[%s] %s%s %s %sms - %s', logUserIp, upstream, logStatus(' ' + statusCode + ' '), logMethod(ctx.method + ' ' + ctx.originalUrl), Date.now() - start, length);
	} else {
		logger.info('[%s] %s%s %s %sms - %s', logUserIp, upstream, logStatus(' ' + statusCode + ' '), logMethod(ctx.method + ' ' + ctx.originalUrl), Date.now() - start, length);
	}


}