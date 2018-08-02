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

import * as Router from 'koa-router';
import { BackglassApi } from '../backglasses/backglass.api';
import { apiCache } from '../common/api.cache';
import { ApiRouter } from '../common/api.router';
import { Scope } from '../common/scope';
import { LogEventApi } from '../log-event/log.event.api';
import { MediumApi } from '../media/medium.api';
import { RatingApi } from '../ratings/rating.api';
import { StarApi } from '../stars/star.api';
import { state } from '../state';
import { GameApi } from './game.api';
import { gameDetailsCacheCounters, gameListCacheCounters } from './game.api.cache.config';

export class GameApiRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const api = new GameApi();
		this.router = api.apiRouter();

		this.router.get('/v1/games',       api.list.bind(api));
		this.router.head('/v1/games/:id',  api.head.bind(api));
		this.router.get('/v1/games/:id',   api.view.bind(api));
		this.router.patch('/v1/games/:id',  api.auth(api.update.bind(api), 'games', 'update', [ Scope.ALL ]));
		this.router.post('/v1/games',       api.auth(api.create.bind(api), 'games', 'add', [ Scope.ALL ]));
		this.router.delete('/v1/games/:id', api.auth(api.del.bind(api), 'games', 'delete', [ Scope.ALL ]));

		const ratingApi = new RatingApi();
		this.router.post('/v1/games/:id/rating', api.auth(ratingApi.createForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));
		this.router.put('/v1/games/:id/rating',  api.auth(ratingApi.updateForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));
		this.router.get('/v1/games/:id/rating',  api.auth(ratingApi.getForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));
		this.router.delete('/v1/games/:id/rating',  api.auth(ratingApi.deleteForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));

		const starsApi = new StarApi();
		this.router.post('/v1/games/:id/star',   api.auth(starsApi.star('game').bind(starsApi), 'games', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
		this.router.delete('/v1/games/:id/star', api.auth(starsApi.unstar('game').bind(starsApi), 'games', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
		this.router.get('/v1/games/:id/star',    api.auth(starsApi.get('game').bind(starsApi), 'games', 'star', [ Scope.ALL, Scope.COMMUNITY ]));

		const backglassApi = new BackglassApi();
		this.router.post('/v1/games/:gameId/backglasses', api.auth(backglassApi.create.bind(backglassApi), 'backglasses', 'add', [ Scope.ALL, Scope.CREATE ]));
		this.router.get('/v1/games/:gameId/backglasses', backglassApi.list.bind(backglassApi));

		const mediumApi = new MediumApi();
		this.router.get('/v1/games/:gameId/media', mediumApi.list.bind(mediumApi));

		const eventsApi = new LogEventApi();
		this.router.get('/v1/games/:id/events', eventsApi.list({ byGame: true }).bind(eventsApi));
		this.router.get('/v1/games/:id/release-name', api.auth(api.releaseName.bind(api), 'releases', 'add', [ Scope.ALL, Scope.CREATE ]));
	}

	public getRouter(): Router {
		return this.router;
	}

	public setupCache() {
		const simpleEntities = state.serializers.Game.getReferences('simple',
			['ContentAuthor', 'ReleaseVersion', 'ReleaseVersionFile', 'File']);
		const detailedEntities = state.serializers.Game.getReferences('detailed',
			['ContentAuthor', 'ReleaseVersion', 'ReleaseVersionFile', 'File'],
			['releases.game', 'backglasses.game', 'media.game', 'media.release']);

		apiCache.enable(this.router, '/v1/games', { entities: simpleEntities, counters: gameListCacheCounters, listModel: 'game' });
		apiCache.enable(this.router, '/v1/games/:id', { entities: detailedEntities, counters: gameDetailsCacheCounters });

		//apiCache.enable(gameApiRouter, '/v1/games/:gameId/backglasses', { resources: ['backglass', 'user'] });
		//apiCache.enable(gameApiRouter, '/v1/games/:gameId/media', { resources: ['medium', 'user'] });
		//apiCache.enable(gameApiRouter, '/v1/games/:id/events', { resources: ['log_event'] });
	}
}
