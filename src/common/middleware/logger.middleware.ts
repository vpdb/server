/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

import bytes = require('bytes');
import chalk, { Chalk, ColorSupport } from 'chalk';
import randomString from 'randomstring';

import { accessLogger } from '../logger';
import { Context } from '../typings/context';

const Counter = require('passthrough-counter');

const statusStyle: { [key: number]: Chalk & { supportsColor: ColorSupport } } = {
	100: chalk.black.bgWhiteBright,
	200: chalk.black.bgGreenBright,
	300: chalk.black.bgCyanBright,
	400: chalk.black.bgYellowBright,
	500: chalk.black.bgRedBright,
};

const methodStyle: { [key: string]: Chalk & { supportsColor: ColorSupport } } = {
	GET: chalk.white.bgBlue,
	HEAD: chalk.white.bgBlack,
	POST: chalk.white.bgGreen,
	PUT: chalk.white.bgYellow,
	DELETE: chalk.white.bgRed,
	CONNECT: chalk.white.bgBlack,
	OPTIONS: chalk.white.bgBlack,
	TRACE: chalk.white.bgBlack,
	PATCH: chalk.white.bgCyan,
};

/**
 * Logs one-liners for each request.
 * Loosely based on https://github.com/koajs/logger/blob/master/index.js
 *
 * @return {(ctx: Context, next: () => Promise<any>) => Promise<void>}
 */
export function koaLogger() {

	return async (ctx: Context, next: () => Promise<any>) => {
		const start = Date.now();
		ctx.state.requestId = randomString.generate(10);
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
		const body = ctx.response.body;
		let counter: { length: number };
		if (length == null && body && body.readable) {
			ctx.response.body = body.pipe(counter = Counter()).on('error', ctx.onerror);
		}

		// log when the response is finished or closed,
		// whichever happens first.
		const res = ctx.res;

		const onFinish = done.bind(null, 'finish');
		const onClose = done.bind(null, 'close');

		if (res.finished) {
			log(ctx, start, counter ? counter.length : length, null);
		} else {
			res.once('finish', onFinish);
			res.once('close', onClose);
		}

		function done(event: string) {
			res.removeListener('finish', onFinish);
			res.removeListener('close', onClose);
			log(ctx, start, counter ? counter.length : length, null, event);
		}
	};
}

function log(ctx: Context, start: number, len: number, err: any = null, event: string = null) {

	const statusCode = err
		? (err.statusCode || err.status || 500)
		: (ctx.status || 404);
	let length;
	if ([204, 205, 304].includes(statusCode)) {
		length = '';
	} else if (len == null) {
		length = '-';
	} else {
		length = bytes(len).toLowerCase();
	}
	let cache: string = '';
	if (ctx.response.headers['x-cache-api']) {
		cache = ' [' + ctx.response.headers['x-cache-api'].toLowerCase() + ']';
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
	const duration = Date.now() - start;
	ctx.state.requestDuration = duration;

	if (statusCode >= 500 && statusCode < 600) {
		accessLogger.error(ctx.state, '[%s] %s%s %s %sms - %s', logUserIp, upstream, logStatus(' ' + statusCode + ' '), logMethod(ctx.method + ' ' + ctx.originalUrl), duration, length);
	} else {
		accessLogger.info(ctx.state, '[%s] %s%s %s %sms - %s%s', logUserIp, upstream, logStatus(' ' + statusCode + ' '), logMethod(ctx.method + ' ' + ctx.originalUrl), duration, length, cache);
	}
}
