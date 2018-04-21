import { Scope } from '../common/scope';
import { UserApi } from './user.api';

const api = new UserApi();
export const router = api.apiRouter();

router.post('/v1/users',       api.anon(api.create.bind(api)));
router.put('/v1/users',        api.auth(api.createOrUpdate.bind(api), '', '', [ Scope.SERVICE ]));
router.get('/v1/users',        api.auth(api.list.bind(api), 'users', 'search', [ Scope.ALL ]));
router.get('/v1/users/:id',    api.auth(api.view.bind(api), 'users', 'view', [ Scope.ALL ]));
router.put('/v1/users/:id',    api.auth(api.update.bind(api), 'users', 'update', [ Scope.ALL ]));
router.del('/v1/users/:id',    api.auth(api.del.bind(api), 'users', 'delete', [ Scope.ALL ]));