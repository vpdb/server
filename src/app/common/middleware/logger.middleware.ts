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
import { isObject } from 'util';

import { logger } from '../logger';
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
		ctx.state.request = {
			id: randomString.generate(10),
			ip: ctx.request.get('x-forwarded-for') || ctx.ip || undefined,
			path: ctx.request.path,
		};
		ctx.response.set('X-Request-Id', ctx.state.request.id);
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
	let length: string;
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
	ctx.state.request.duration = duration;
	ctx.state.request.size = len;

	// log this
	const message = `[${logUserIp}] ${upstream}${logStatus(' ' + statusCode + ' ')} ${logMethod(ctx.method + ' ' + ctx.originalUrl)} ${duration}ms - ${length}${cache}`;
	const level = statusCode >= 500 ? 'error' : 'info';
	const fullLog = statusCode >= 400 && statusCode !== 404;
	const requestHeaders = stripAuthHeaders(ctx.request.headers);
	logger.text(ctx.state, level, message);
	logger.json(ctx.state, level, {
		type: 'access',
		message: `${ctx.method} ${ctx.originalUrl} [${ctx.response.status}]`,
		level,
		request: {
			id: ctx.state.request.id,
			ip: ctx.state.request.ip,
			method: ctx.request.method,
			path: ctx.request.url,
			headers: fullLog ? Object.keys(requestHeaders)
				.filter(header => !['accept', 'connection', 'pragma', 'cache-control', 'host', 'origin'].includes(header))
				.reduce((obj: { [key: string]: string }, key: string) => { obj[key] = requestHeaders[key]; return obj; }, {}) : undefined,
			body: ctx.request.get('content-type').startsWith('application/json') ? ctx.request.rawBody : undefined,
		},
		response: {
			status: ctx.response.status,
			body: fullLog && ctx.response.get('content-type').startsWith('application/json') ? (isObject(ctx.response.body) ? JSON.stringify(ctx.response.body) : ctx.response.body) : undefined,
			headers: fullLog ? Object.keys(ctx.response.headers)
				.filter(header => !['x-request-id', 'x-user-id', 'x-user-dirty', 'x-cache-api', 'x-response-time', 'x-token-refresh', 'vary', 'access-control-allow-origin', 'access-control-allow-credentials', 'access-control-expose-headers'].includes(header))
				.reduce((obj: { [key: string]: string }, key: string) => { obj[key] = ctx.response.headers[key]; return obj; }, {}) : undefined,
			duration: ctx.state.request.duration,
			size: ctx.state.request.size,
			cached: ctx.response.headers['x-cache-api'] ? ctx.response.headers['x-cache-api'] === 'HIT' : undefined,
		},
	});
}

function stripAuthHeaders(headers: { [key: string]: string }) {
	if (!headers.authorization) {
		return headers;
	}
	const [bearer, token] = headers.authorization.split(' ');
	const jwtParts = token.split('.');
	let stripped: string;
	if (jwtParts.length === 3) {
		stripped = jwtParts.map(p => p.replace(/^(.{3})(.+)(.{3})$/, '$1***$3')).join('.');
	} else {
		stripped = token.replace(/^(.{3})(.+)(.{3})$/, '$1***$3')
	}
	headers.authorization = `${bearer} ${stripped}`;
	return headers;
}
