var api = require('./api');

exports.auth = api.auth;
exports.anon = api.anon;
exports.ping = api.ping;
exports.files = require('./files');
exports.games = require('./games');
exports.ipdb = require('./ipdb');
exports.roles = require('./roles');
exports.tags = require('./tags');
exports.users = require('./users');
