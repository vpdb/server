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

import { extend } from 'lodash';
import { format, parse } from 'url';
import builder from 'xmlbuilder';

import { roles } from '../common/acl';
import { Api } from '../common/api';
import { apiCache } from '../common/api.cache';
import { ApiError } from '../common/api.error';
import { gitInfo } from '../common/gitinfo';
import { ipdb } from '../common/ipdb';
import { logger } from '../common/logger';
import { config } from '../common/settings';
import { Context } from '../common/typings/context';
import { FileDocument } from '../files/file.document';
import { processorQueue } from '../files/processor/processor.queue';
import { GameDocument } from '../games/game.document';
import { state } from '../state';
import { UserDocument } from '../users/user.document';

const pak = require('../../../package.json');

export class MiscApi extends Api {

	/**
	 * The root URL of the API. Returns app version and revision.
	 *
	 * @see GET /v1
	 * @param {Application.Context} ctx Koa context
	 */
	public async index(ctx: Context) {

		const result = {
			app_name: config.vpdb.name,
			app_version: pak.version,
			app_date: gitInfo.hasInfo() ? gitInfo.getLastCommit().lastCommitTime : undefined,
			app_sha: gitInfo.hasInfo() ? gitInfo.getLastCommit().SHA : undefined,
		};
		return this.success(ctx, result, 200);
	}

	/**
	 * Retrieves metadata from IPDB.org.
	 *
	 * @see GET /v1/ipdb/:id
	 * @param {Context} ctx Koa context
	 */
	public async ipdbDetails(ctx: Context) {
		const game = await ipdb.details(ctx.state, ctx.params.id, { offline: ctx.query.dryrun });
		return this.success(ctx, game);
	}

	/**
	 * Returns all available ACL roles.
	 *
	 * @see GET /v1/roles
	 * @param {Application.Context} ctx Koa context
	 */
	public async roles(ctx: Context) {
		return this.success(ctx, roles, 200);
	}

	/**
	 * Returns all available plans
	 *
	 * @see GET /v1/plans
	 * @param {Application.Context} ctx Koa context
	 */
	public async plans(ctx: Context) {
		const plans: any[] = [];
		config.vpdb.quota.plans.forEach(plan => {
			plans.push(extend(plan, {
				name: plan.name || plan.id,
				is_default: plan.id === config.vpdb.quota.defaultPlan,
			}));
		});
		return this.success(ctx, plans, 200);
	}

	/**
	 * Returns a ping.
	 *
	 * @see GET /v1/ping
	 * @param {Application.Context} ctx Koa context
	 */
	public async ping(ctx: Context) {
		return this.success(ctx, { result: 'pong' }, 200);
	}

	/**
	 * Clears the API cache.
	 *
	 * @param {Context} ctx Koa context
	 * @return {Promise<boolean>} Number of caches cleared
	 */
	public async invalidateCache(ctx: Context) {
		const now = Date.now();
		const num = await apiCache.invalidateAll();
		logger.info(ctx.state, '[MiscApi.invalidateCache] Cleared %s caches in %sms.', num, Date.now() - now);
		return this.success(ctx, { cleared: num }, 204);
	}

	/**
	 * Prints the sitemap for a site running vpdb-website.
	 * @param {Context} ctx
	 * @returns {Promise<void>}
	 */
	public async sitemap(ctx: Context) {

		if (!ctx.query.url) {
			throw new ApiError('Must specify website URL as "url" parameter.').status(400);
		}
		const parsedUrl = parse(ctx.query.url);
		if (!parsedUrl.host || !parsedUrl.protocol) {
			throw new ApiError('URL must contain at least protocol and host name.').status(400);
		}
		if (parsedUrl.search || parsedUrl.hash) {
			throw new ApiError('URL must not contain a search query or hash').status(400);
		}

		const webUrl = format(parsedUrl);

		const rootNode = builder
			.create('urlset', { version: '1.0', encoding: 'UTF-8' })
			.att('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
			.att('xmlns:image', 'http://www.google.com/schemas/sitemap-image/1.1');

		// static urls
		rootNode.ele('url').ele('loc', webUrl);
		rootNode.ele('url').ele('loc', webUrl + 'games');
		rootNode.ele('url').ele('loc', webUrl + 'releases');
		rootNode.ele('url').ele('loc', webUrl + 'about');
		rootNode.ele('url').ele('loc', webUrl + 'rules');
		rootNode.ele('url').ele('loc', webUrl + 'faq');
		rootNode.ele('url').ele('loc', webUrl + 'legal');
		rootNode.ele('url').ele('loc', webUrl + 'privacy');

		// releases
		const releases = await state.models.Release.find({})
			.populate('_game')
			.populate('versions.files._playfield_images')
			.populate('authors._user')
			.exec();
		releases.forEach(release => {
			const game = release._game as GameDocument;
			let fsImage: FileDocument;
			let dtImage: FileDocument;
			release.versions.forEach(version => {
				version.files.forEach(file => {
					const playfieldImage = file._playfield_images[0] as FileDocument;
					if (playfieldImage.metadata.size.width > playfieldImage.metadata.size.height) {
						dtImage = playfieldImage;
					} else {
						fsImage = playfieldImage;
					}
				});
			});
			const authors = release.authors.map(author => (author._user as UserDocument).name).join(', ');
			const url = rootNode.ele('url');
			url.ele('loc', webUrl + 'games/' + game.id + '/releases/' + release.id);
			if (fsImage) {
				const img = url.ele('image:image');
				img.ele('image:loc', fsImage.getUrl(fsImage.getVariation('full')));
				img.ele('image:caption', 'Portrait playfield for ' + game.title + ', ' + release.name + ' by ' + authors + '.');
			}
			if (dtImage) {
				const img = url.ele('image:image');
				img.ele('image:loc', dtImage.getUrl(dtImage.getVariation('full')));
				img.ele('image:caption', 'Landscape playfield for ' + game.title + ', ' + release.name + ' by ' + authors + '.');
			}
		});

		// games
		const games = await state.models.Game.find({}).exec();
		for (const game of games) {

			const url = rootNode.ele('url');
			url.ele('loc', webUrl + 'games/' + game.id);

			const media = await state.models.Medium.find({ '_ref.game': game._id }).populate({ path: '_file' }).exec();
			for (const medium of media) {
				const file = medium._file as FileDocument;
				switch (medium.category) {
					case 'wheel_image': {
						const img = url.ele('image:image');
						img.ele('image:loc', file.getUrl(file.getVariation('medium-2x')));
						img.ele('image:caption', 'Logo for ' + game.title);
						break;
					}
					case 'backglass_image': {
						const img = url.ele('image:image');
						img.ele('image:loc', file.getUrl(file.getVariation('full')));
						img.ele('image:caption', 'Backglass for ' + game.title);
						break;
					}
				}
			}
		}
		ctx.status = 200;
		ctx.set('Content-Type', 'application/xml');
		ctx.response.body = rootNode.end({ pretty: true });
	}

	/**
	 * Terminates the server.
	 *
	 * @see POST /v1/kill
	 * @param {Application.Context} ctx Koa context
	 */
	public async kill(ctx: Context) {

		// send response
		this.success(ctx, { result: 'shutting down.' }, 200);

		// wait for jobs to finish
		processorQueue.waitForLastJob(ctx.state).then(() => {
			// and off we go.
			logger.wtf(ctx.state, '[MiscApi] Shutting down.');
			setTimeout(() => process.exit(0), 500);
		});
	}
}
