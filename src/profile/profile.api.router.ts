import { Scope } from '../common/scope';
import { ProfileApi } from './profile.api';

const api = new ProfileApi();
export const router = api.apiRouter();

router.get('/v1/user',              api.auth(api.view.bind(api), 'user', 'view', [ Scope.ALL, Scope.COMMUNITY ]));
router.patch('/v1/user',            api.auth(api.update.bind(api), 'user', 'update', [ Scope.ALL ]));
//router.get('/v1/user/logs',         api.auth(userlogApi.list, 'user', 'view', [ scope.ALL ]));
//router.get('/v1/user/events',       api.auth(eventsApi.list({ loggedUser: true }), 'user', 'view', [ scope.ALL ]));
router.get('/v1/user/confirm/:tkn', api.anon(api.confirm.bind(api)));
