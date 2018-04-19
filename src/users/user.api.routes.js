const UserApi = require('./user.api');
const scope = require('../common/scope');

const api = new UserApi();
const router = api.apiRouter();

router.post('/v1/users',       api.anon(api.create.bind(api)));
router.put('/v1/users',        api.auth(api.createOrUpdate.bind(api), '', '', [ scope.SERVICE ]));
router.get('/v1/users',        api.auth(api.list.bind(api), 'users', 'search', [ scope.ALL ]));
router.get('/v1/users/:id',    api.auth(api.view.bind(api), 'users', 'view', [ scope.ALL ]));
router.put('/v1/users/:id',    api.auth(api.update.bind(api), 'users', 'update', [ scope.ALL ]));
router.del('/v1/users/:id',    api.auth(api.del.bind(api), 'users', 'delete', [ scope.ALL ]));

// router.post('/v1/users/:id/star',   api.auth(api.stars.star('user'), 'users', 'star', [ scope.ALL, scope.COMMUNITY ]));
// router.del('/v1/users/:id/star', api.auth(api.stars.unstar('user'), 'users', 'star', [ scope.ALL, scope.COMMUNITY ]));
// router.get('/v1/users/:id/star',    api.auth(api.stars.get('user'), 'users', 'star', [ scope.ALL, scope.COMMUNITY ]));
//
// router.get('/v1/users/:id/events',             api.anon(api.events.list({ byActor: true })));
// router.post('/v1/users/:id/send-confirmation', api.auth(api.users.sendConfirmationMail, 'users', 'send-confirmation', [ scope.ALL ]));

module.exports = router;