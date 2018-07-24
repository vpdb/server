# Third Party Services

VPDB uses a couple of services.

## Raygun

[Raygun](https://raygun.com/) is a crash reporter. It is configured in the 
settings, more precisely at `vpdb.services.raygun`.

## Rollbar

[Rollbar](https://rollbar.com) is another crash reporter. Like Raygun, it's configured in the
settings at `vpdb.services.rollbar`.

## Sqreen

[Sqreen](https://www.sqreen.io) provides several security-related features.  
You can enable Sqreen by setting the `SQREEN_ENABLED` environment variable to 
something truthy. Other configurations such as `SQREEN_TOKEN` are documented
[here](https://docs.sqreen.io/sqreen-for-nodejs/nodejs-agent-installation/).