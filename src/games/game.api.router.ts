/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

import { Scope } from '../common/scope';
import { GameApi } from './game.api';
import { LogEventApi } from '../log-event/log.event.api';
import { StarApi } from '../stars/star.api';
import { MediumApi } from '../media/medium.api';
import { RatingApi } from '../ratings/rating.api';
import { BackglassApi } from '../backglasses/backglass.api';

const api = new GameApi();
const eventsApi = new LogEventApi();
const starsApi = new StarApi();
const ratingApi = new RatingApi();
const mediumApi = new MediumApi();
const backglassApi = new BackglassApi();

export const router = api.apiRouter();

router.get('/v1/games',        api.anon(api.list.bind(api)));
router.head('/v1/games/:id',   api.anon(api.head.bind(api)));
router.get('/v1/games/:id',    api.anon(api.view.bind(api)));
router.patch('/v1/games/:id',  api.auth(api.update.bind(api), 'games', 'update', [ Scope.ALL ]));
router.post('/v1/games',       api.auth(api.create.bind(api), 'games', 'add', [ Scope.ALL ]));
router.delete('/v1/games/:id', api.auth(api.del.bind(api), 'games', 'delete', [ Scope.ALL ]));

router.post('/v1/games/:id/rating', api.auth(ratingApi.createForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));
router.put('/v1/games/:id/rating',  api.auth(ratingApi.updateForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));
router.get('/v1/games/:id/rating',  api.auth(ratingApi.getForGame.bind(ratingApi), 'games', 'rate', [ Scope.ALL, Scope.COMMUNITY ]));

router.post('/v1/games/:id/star',   api.auth(starsApi.star('game').bind(starsApi), 'games', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
router.delete('/v1/games/:id/star', api.auth(starsApi.unstar('game').bind(starsApi), 'games', 'star', [ Scope.ALL, Scope.COMMUNITY ]));
router.get('/v1/games/:id/star',    api.auth(starsApi.get('game').bind(starsApi), 'games', 'star', [ Scope.ALL, Scope.COMMUNITY ]));

router.post('/v1/games/:gameId/backglasses', api.auth(backglassApi.create.bind(backglassApi), 'backglasses', 'add', [ Scope.ALL, Scope.CREATE ]));
router.get('/v1/games/:gameId/backglasses',  api.anon(backglassApi.list.bind(backglassApi)));

router.get('/v1/games/:gameId/media', api.anon(mediumApi.list.bind(mediumApi)));

router.get('/v1/games/:id/events', api.anon(eventsApi.list({ byGame: true }).bind(eventsApi)));

router.get('/v1/games/:id/release-name', api.auth(api.releaseName.bind(api), 'releases', 'add', [ Scope.ALL, Scope.CREATE ]));
