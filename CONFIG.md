# VPDB Configuration

This describes how in particular VPDB organizes configuration settings and changes.

## Configuration File

In the repo we have ``server/config/settings-dist.js``. This is the distributed configuration file that is maintained as
new values are added. Detailed documentation about each value can be found in the
[file itself](https://github.com/vpdb/backend/blob/master/server/config/settings-dist.js).

Per default, VPDB checks ``server/config/settings.js`` for your customized settings file. This can be changed by setting
the environment variable ``APP_SETTINGS`` to a different path. If neither exists, ``app.js`` exits upon start. Before
starting VPDB the first time, copy ``settings-dist.js`` to ``settings.js`` and update its values.

The configuration file is not JSON but laid out as a Node module for two reasons:

1. JSON doesn't allow comments
2. No need to wrap property names into quotes

## Validation

Every value in the settings file is validated when ``app.js`` starts. The validations are defined at
``server/config/settings-validate.js``. You can however separately check whether the validations pass by running
``node server/config/validate.js``, which will exit with ``0`` if validations passed or ``1`` of anything failed.

Running the check separately would be a wise thing to do before swapping out new production code, for instance.

## Migration

With new versions there will obviously be new settings introduced. In order to migrate new settings from
``settings-dist.js`` into your settings file, you can run ``node server/config/migrate.js``. This will exit with ``1``
if there was at least one new value annotated with ``@important``, an indication that this setting won't work with its
default value and needs to be changed manually. It exits with ``2`` if there were errors and with ``0`` if everything
was okay and no ``@important`` values were migrated.

## Other Files

On a production deployment, there are other files to configure (see [INSTALL](INSTALL.md)):

* ``/repo/[production|staging]/hooks/common`` - Deployment config
* ``/etc/init/vpdb-[production|staging].conf`` - Environment config
