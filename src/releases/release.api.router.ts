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

import Router = require('koa-router');
import { CommentApi } from '../comments/comment.api';
import { apiCache } from '../common/api.cache';
import { ApiRouter } from '../common/api.router';
import { Scope } from '../common/scope';
import { LogEventApi } from '../log-event/log.event.api';
import { RatingApi } from '../ratings/rating.api';
import { StarApi } from '../stars/star.api';
import { state } from '../state';
import { ReleaseApi } from './release.api';
import { releaseDetailsCacheCounters, releaseListCacheCounters } from './release.api.cache.config';
import { ReleaseVersionFileApi } from './version/file/release.version.file.api';
import { ReleaseVersionApi } from './version/release.version.api';

export class ReleaseApiRouter implements ApiRouter {

	private readonly router: Router;

	constructor() {
		const api = new ReleaseApi();
		this.router = api.apiRouter();

		this.router.get('/v1/releases',       api.list.bind(api));
		this.router.get('/v1/releases/:id',   api.view.bind(api));
		this.router.patch('/v1/releases/:id',  api.auth(api.update.bind(api), 'releases', 'update-own', [Scope.ALL, Scope.CREATE]));
		this.router.post('/v1/releases',       api.auth(api.create.bind(api), 'releases', 'add', [Scope.ALL, Scope.CREATE]));
		this.router.delete('/v1/releases/:id', api.auth(api.del.bind(api), 'releases', 'delete-own', [Scope.ALL, Scope.CREATE]));

		const versionApi = new ReleaseVersionApi();
		this.router.post('/v1/releases/:id/versions',                               versionApi.auth(versionApi.addVersion.bind(api), 'releases', 'add', [Scope.ALL, Scope.CREATE]));
		this.router.patch('/v1/releases/:id/versions/:version',                     versionApi.auth(versionApi.updateVersion.bind(api), 'releases', 'update-own', [Scope.ALL, Scope.CREATE]));

		const versionFileApi = new ReleaseVersionFileApi();
		this.router.post('/v1/releases/:id/versions/:version/files/:file/validate', versionFileApi.auth(versionFileApi.validateFile.bind(api), 'releases', 'validate', [Scope.ALL, Scope.CREATE]));

		const ratingApi = new RatingApi();
		this.router.post('/v1/releases/:id/rating', api.auth(ratingApi.createForRelease.bind(ratingApi), 'releases', 'rate', [Scope.ALL, Scope.COMMUNITY]));
		this.router.put('/v1/releases/:id/rating',  api.auth(ratingApi.updateForRelease.bind(ratingApi), 'releases', 'rate', [Scope.ALL, Scope.COMMUNITY]));
		this.router.get('/v1/releases/:id/rating',  api.auth(ratingApi.getForRelease.bind(ratingApi), 'releases', 'rate', [Scope.ALL, Scope.COMMUNITY]));
		this.router.delete('/v1/releases/:id/rating',  api.auth(ratingApi.deleteForRelease.bind(ratingApi), 'releases', 'rate', [Scope.ALL, Scope.COMMUNITY]));

		const starApi = new StarApi();
		this.router.post('/v1/releases/:id/star',   api.auth(starApi.star('release').bind(starApi), 'releases', 'star', [Scope.ALL, Scope.COMMUNITY]));
		this.router.delete('/v1/releases/:id/star', api.auth(starApi.unstar('release').bind(starApi), 'releases', 'star', [Scope.ALL, Scope.COMMUNITY]));
		this.router.get('/v1/releases/:id/star',    api.auth(starApi.get('release').bind(starApi), 'releases', 'star', [Scope.ALL, Scope.COMMUNITY]));

		const commentApi = new CommentApi();
		this.router.get('/v1/releases/:id/comments', commentApi.listForRelease.bind(commentApi));
		this.router.post('/v1/releases/:id/comments', api.auth(commentApi.createForRelease.bind(commentApi), 'comments', 'add', [ Scope.ALL, Scope.COMMUNITY ]));
		this.router.post('/v1/releases/:id/moderate',          api.auth(api.moderate.bind(api), 'releases', 'moderate', [Scope.ALL]));
		this.router.post('/v1/releases/:id/moderate/comments', api.auth(commentApi.createForReleaseModeration.bind(commentApi), 'releases', 'add', [ Scope.ALL ]));
		this.router.get('/v1/releases/:id/moderate/comments',  api.auth(commentApi.listForReleaseModeration.bind(commentApi), 'releases', 'add', [ Scope.ALL ]));

		const eventApi = new LogEventApi();
		this.router.get('/v1/releases/:id/events', eventApi.list({ byRelease: true }).bind(eventApi));
	}

	public getRouter(): Router {
		return this.router;
	}
	public setupCache(): void {

		const simpleEntities = state.serializers.Release.getReferences('simple',
			['ContentAuthor', 'ReleaseVersion', 'ReleaseVersionFile', 'File' ]);
		const detailedEntities = state.serializers.Release.getReferences('detailed',
			['ContentAuthor', 'ReleaseVersion', 'ReleaseVersionFile', 'File' ]);

		apiCache.enable(this.router, '/v1/releases', simpleEntities, releaseListCacheCounters);
		apiCache.enable(this.router, '/v1/releases/:id', detailedEntities, releaseDetailsCacheCounters);
		//apiCache.enable(this.router, '/v1/releases/:id/comments', { entities: { release: 'id' } });
	}
}
