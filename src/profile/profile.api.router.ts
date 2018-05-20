import { Scope } from '../common/scope';
import { ProfileApi } from './profile.api';
import { LogUserApi } from '../log-user/log.user.api';
import { LogEventApi } from '../log-event/log.event.api';

const api = new ProfileApi();
const logApi = new LogUserApi();
const eventsApi = new LogEventApi();
export const router = api.apiRouter();

router.get('/v1/profile',              api.auth(api.view.bind(api), 'user', 'view', [ Scope.ALL, Scope.COMMUNITY ]));
router.patch('/v1/profile',            api.auth(api.update.bind(api), 'user', 'update', [ Scope.ALL ]));
router.get('/v1/profile/logs',         api.auth(logApi.list.bind(api), 'user', 'view', [ Scope.ALL ]));
router.get('/v1/profile/events',       api.auth(eventsApi.list.bind(eventsApi)({ loggedUser: true }), 'user', 'view', [ Scope.ALL ]));
router.get('/v1/profile/confirm/:tkn', api.anon(api.confirm.bind(api)));

// deprecated, remove when clients are updated.
router.get('/v1/user',              api.auth(api.view.bind(api), 'user', 'view', [ Scope.ALL, Scope.COMMUNITY ]));
router.patch('/v1/user',            api.auth(api.update.bind(api), 'user', 'update', [ Scope.ALL ]));
router.get('/v1/user/logs',         api.auth(logApi.list.bind(api), 'user', 'view', [ Scope.ALL ]));
router.get('/v1/user/events',       api.auth(eventsApi.list.bind(eventsApi)({ loggedUser: true }), 'user', 'view', [ Scope.ALL ]));
router.get('/v1/user/confirm/:tkn', api.anon(api.confirm.bind(api)));
