var api = require('./api');

exports.auth = api.auth;
exports.ping = api.ping;
exports.passport = api.passport;
exports.files = require('./files');
exports.games = require('./games');
exports.ipdb = require('./ipdb');
exports.roles = require('./roles');
exports.users = require('./users');
