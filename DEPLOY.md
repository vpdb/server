# VPDB Deployment

This explains how you will be able to deploy releases in production after following the [installation guide](INSTALL.md).

## Getting Code Upstream

On the production server, the source code of VPDB is cloned twice in a bare Git repository. "Bare" means only Git's
internal files (usually sitting in the ``.git`` folder) will be created. Those repos serve only as remote repositories
and don't contain the working tree of the code.

One of those repos is the *staging* repo and the other is the *production* repo. In order to deploy code, you simply
push it to either repo.

## Setup

On server side, you've cloned these repos into ``/repos/staging`` and ``/repos/production`` respectively. On your local
machine, given you're in the directory where you have cloned the ``node-vpdb`` repo from GitHub, you can add the new
remotes like so:

	git remote add production ssh://deployer@1.2.3.4/repos/production
	git remote add staging ssh://deployer@1.2.3.4/repos/staging

Where ``1.2.3.4`` is the IP address of your production server (host name works too). Of course you'll need to have your
SSH public key added to the server's ``deployer`` account.

## Staging Deployment

Given you now have a release candidate that you want to deploy to staging, you simply push your code to the ``staging``
repo:

	git push staging master

This will do the following:

1. Upload the latest code to the server
2. Clone the repo into a new folder on the server
3. Run ``npm install`` in that folder
4. Move the pointer of the current web folder to the new folder
5. Reload the Node cluster (resulting in zero downtime)
6. Clean up old deployments if necessary

If anything goes wrong, deployment is aborted.

## Production Deployment

The principle here is the same, but there's still a difference: In production, only *tagged* versions are deployed. That
means if you feel that a commit is ready for production, you need to tag it so it can be deployed into production:

	git tag -a v0.0.2 -m "Released version 0.0.2."
	git push production master --tags

The version should match the [Semantic Versioning](http://semver.org/) scheme, prefixed with a ``v``. Note that always
the latest tag is deployed, so if there was previous tag that wasn't deployed, it will be ignored. Also note that
deployment will be aborted if the latest tag is already deployed.

