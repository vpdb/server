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

import { BackglassApi } from '../backglasses/backglass.api';
import { apiCache } from '../common/api.cache';
import { Scope } from '../common/scope';
import { LogEventApi } from '../log-event/log.event.api';
import { MediumApi } from '../media/medium.api';
import { RatingApi } from '../ratings/rating.api';
import { StarApi } from '../stars/star.api';
import { GameApi } from './game.api';
import { gameDetailsCacheCounters, gameListCacheCounters } from './game.api.cache.config';

const api = new GameApi();
const eventsApi = new LogEventApi();
const starsApi = new StarApi();
const ratingApi = new RatingApi();
const mediumApi = new MediumApi();
const backglassApi = new BackglassApi();

export const gameApiRouter = api.apiRouter();

gameApiRouter.get('/v1/games',       api.list.bind(api));
gameApiRouter.head('/v1/games/:id',  api.head.bind(api));
gameApiRouter.get('/v1/games/:id',   api.view.bind(api));
gameApiRouter.patch('/v1/games/:id',  api.auth(api.update.bind(api), 'games', 'update', [ Scope.ALL ]));
gameApiRouter.post('/v1/games',       api.auth(api.create.bind(api), 'games', 'add', [ Scope.ALL ]));
gameApiRouter.delete('/v1/games/:id', api.auth(api.del.bind(api), 'games', 'delete', [ Scope.ALL ]));

gameApiRouter.post('/v1/games/:id/rating', api.auth(ratingApi.createForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));
gameApiRouter.put('/v1/games/:id/rating',  api.auth(ratingApi.updateForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));
gameApiRouter.get('/v1/games/:id/rating',  api.auth(ratingApi.getForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));
gameApiRouter.delete('/v1/games/:id/rating',  api.auth(ratingApi.deleteForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));

gameApiRouter.post('/v1/games/:id/star',   api.auth(starsApi.star('game').bind(starsApi), 'games', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
gameApiRouter.delete('/v1/games/:id/star', api.auth(starsApi.unstar('game').bind(starsApi), 'games', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
gameApiRouter.get('/v1/games/:id/star',    api.auth(starsApi.get('game').bind(starsApi), 'games', 'star', [ Scope.ALL, Scope.COMMUNITY ]));

gameApiRouter.post('/v1/games/:gameId/backglasses', api.auth(backglassApi.create.bind(backglassApi), 'backglasses', 'add', [ Scope.ALL, Scope.CREATE ]));
gameApiRouter.get('/v1/games/:gameId/backglasses', backglassApi.list.bind(backglassApi));

gameApiRouter.get('/v1/games/:gameId/media', mediumApi.list.bind(mediumApi));

gameApiRouter.get('/v1/games/:id/events', eventsApi.list({ byGame: true }).bind(eventsApi));
gameApiRouter.get('/v1/games/:id/release-name', api.auth(api.releaseName.bind(api), 'releases', 'add', [ Scope.ALL, Scope.CREATE ]));

apiCache.enable(gameApiRouter, '/v1/games', [ { modelName: 'Game', path: 'id', level: 'simple' } ], gameListCacheCounters);
apiCache.enable(gameApiRouter, '/v1/games/:id', [
	{ modelName: 'Game', path: 'id', level: 'detailed' },
	{ modelName: 'Release', path: 'releases.id', level: 'detailed' },
	{ modelName: 'Backglass', path: 'backglasses.id', level: 'simple' },
	{ modelName: 'User', path: 'releases.created_by.id', level: 'reduced' },
	{ modelName: 'User', path: 'releases.authors.user.id', level: 'reduced' },
	{ modelName: 'User', path: 'backglasses.created_by.id', level: 'reduced' },
	{ modelName: 'User', path: 'backglasses.authors.user.id', level: 'reduced' },
	{ modelName: 'Build', path: 'releases.versions.files.compatibility.id', level: 'simple' },
	{ modelName: 'Tag', path: 'releases.tags.id', level: 'simple' },
], gameDetailsCacheCounters);

//apiCache.enable(gameApiRouter, '/v1/games/:gameId/backglasses', { resources: ['backglass', 'user'] });
//apiCache.enable(gameApiRouter, '/v1/games/:gameId/media', { resources: ['medium', 'user'] });
//apiCache.enable(gameApiRouter, '/v1/games/:id/events', { resources: ['log_event'] });
