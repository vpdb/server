---
title: API Tests
header: Tests
template: page.jade
menuIndex: 1
subsectionIndex: 4
---

# Overview

Backend code is entirely tested through the REST API and there is no unit test
coverage at the moment.

For now, we're able to get good coverage with this approach. However, there are
some tweaks that were applied when running in test environments. Most of the
tweaks avoid querying third party services during testing. In fact, there is
only [one single test][ipdbtest] that hits another site (ipdb.org), but it's an
important test since ipdb could change their layout and break the scraper.

The tweaks are described as follows.

## Code Coverage

When running tests, instrumention is enabled in order to measure test coverage
on server side. This is done by loading the `instanbul-middleware` module at
[`app.js`][coverage].

Since enabling instrumentation results in different stack traces, you might
want to quickly disable this in order to debug a test:

```javascript
if (false && process.env.COVERAGE_ENABLED) {
	// ...
}
```

This should do the trick.

## OAuth2 Authentication

Testing GitHub authentication is difficult because it would involve creating a
GitHub test user and hit github.com on every test run, introducing flakiness.
In order to test OAuth-authenticated users, there is an additional REST
resource that allows posting data that would normally come from GitHub or any
other authentication provider.

The resource sits at `/v1/authenticate/mock` and is enabled at [`routes.js`][oauthmock]
when not in production:

```javascript
if (process.env.NODE_ENV === 'test') {
	// mock route for simulating oauth2 callbacks
	app.post(settings.apiPath('/authenticate/mock'), api.user.authenticateOAuth2Mock);
}
```

## Email Confirmation

There are two behaviors that differ from the production environment:

1. Users at VPDB must confirm their email address when registering locally.
   During tests we want to assert that behavior, but we won't be testing that
   the email is actually sent. So when registering, the email token is returned
   with the user entity if the `returnEmailToken` property is provided.

2. Since there are tens of test suites that each create their own users, want
   to be able to disable email confirmation completely. Thus, when registering,
   the `skipEmailConfirmation` property can be provided in order to instantly
   activate the user.

Code-wise, both are implemented at [`api/users.js`][usersjs] in the `create()`
method. This is the only case so far that could be easily done with a unit
test.


[coverage]: https://github.com/freezy/node-vpdb/blob/master/app.js#L10
[oauthmock]: https://github.com/freezy/node-vpdb/blob/master/server/routes.js#L58
[ipdbtest]: https://github.com/freezy/node-vpdb/blob/master/test/api/ipdb.test.js#L26
[usersjs]: https://github.com/freezy/node-vpdb/blob/master/server/controllers/api/users.js