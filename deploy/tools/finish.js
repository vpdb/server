'use strict';

const url = 'http://127.0.0.1:' + process.env.PORT + '/api/v1/kill';
console.log("[test] Killing off server at %s", url);
require('request').post({ url: url, headers: { 'Content-Type': 'application/json' } }, () => console.log('[test] Killswitch triggered.'));
