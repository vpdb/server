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

import { Scope } from '../common/scope';
import { ReleaseApi } from './release.api';
import { RatingApi } from '../ratings/rating.api';
import { StarApi } from '../stars/star.api';
import { LogEventApi } from '../log-event/log.event.api';

const api = new ReleaseApi();
const ratingApi = new RatingApi();
const starApi = new StarApi();
const eventApi = new LogEventApi();
export const router = api.apiRouter();

router.get('/v1/releases',        api.anon(api.list.bind(api)));
router.get('/v1/releases/:id',    api.anon(api.view.bind(api)));
router.patch('/v1/releases/:id',  api.auth(api.update.bind(api), 'releases', 'update-own', [Scope.ALL, Scope.CREATE]));
router.post('/v1/releases',       api.auth(api.create.bind(api), 'releases', 'add', [Scope.ALL, Scope.CREATE]));
router.delete('/v1/releases/:id', api.auth(api.del.bind(api), 'releases', 'delete-own', [Scope.ALL, Scope.CREATE]));

router.post('/v1/releases/:id/versions',                               api.auth(api.addVersion.bind(api), 'releases', 'add', [Scope.ALL, Scope.CREATE]));
router.patch('/v1/releases/:id/versions/:version',                     api.auth(api.updateVersion.bind(api), 'releases', 'update-own', [Scope.ALL, Scope.CREATE]));
router.post('/v1/releases/:id/versions/:version/files/:file/validate', api.auth(api.validateFile.bind(api), 'releases', 'validate', [Scope.ALL, Scope.CREATE]));

// router.get('/v1/releases/:id/comments',  api.anon(api.commentApi.listForRelease.bind(commentApi)));
// router.post('/v1/releases/:id/comments', api.auth(api.commentApi.createForRelease.bind(commentApi), 'comments', 'add', [ Scope.ALL, Scope.COMMUNITY ]));

router.post('/v1/releases/:id/rating', api.auth(ratingApi.createForRelease.bind(ratingApi), 'releases', 'rate', [Scope.ALL, Scope.COMMUNITY]));
router.put('/v1/releases/:id/rating',  api.auth(ratingApi.updateForRelease.bind(ratingApi), 'releases', 'rate', [Scope.ALL, Scope.COMMUNITY]));
router.get('/v1/releases/:id/rating',  api.auth(ratingApi.getForRelease.bind(ratingApi), 'releases', 'rate', [Scope.ALL, Scope.COMMUNITY]));

router.post('/v1/releases/:id/star',   api.auth(starApi.star('release').bind(starApi), 'releases', 'star', [Scope.ALL, Scope.COMMUNITY]));
router.delete('/v1/releases/:id/star', api.auth(starApi.unstar('release').bind(starApi), 'releases', 'star', [Scope.ALL, Scope.COMMUNITY]));
router.get('/v1/releases/:id/star',    api.auth(starApi.get('release').bind(starApi), 'releases', 'star', [Scope.ALL, Scope.COMMUNITY]));

router.post('/v1/releases/:id/moderate',     api.auth(api.moderate.bind(api), 'releases', 'moderate', [Scope.ALL]));
// router.post('/v1/releases/:id/moderate/comments', api.auth(commentApi.createForReleaseModeration).bind(commentApi), 'releases', 'add', [ Scope.ALL ]));
// router.get('/v1/releases/:id/moderate/comments',  api.auth(commentApi.listForReleaseModeration).bind(commentApi), 'releases', 'add', [ Scope.ALL ]));

router.get('/v1/releases/:id/events', api.anon(eventApi.list({ byRelease: true }).bind(eventApi)));