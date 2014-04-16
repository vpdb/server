'use strict';

var _ = require('underscore');
var asset = require('../modules/asset');

exports.middleware = function() {

	var sizes = {
		square: { small: 150, medium: 300 }
	};

	return function(req, res, next) {
		// example: /asset/release/954/square-small.png
		var m = req.originalUrl.match(/^\/asset\/([^\/]+)\/([^\/]+)\/([^\-]+)(-[^\-]+)?\.png$/i);
		if (m) {
			var type = m[1];
			var key = m[2];
			var format = m[3];
			var size = m[4] ? m[4].substr(1) : null;

			if (_.contains(['square'], format)) {
				var s = size && sizes[format][size] ? sizes[format][size] : null;
				asset[format].call(asset, { res: res, req: req }, type, key, s);
			} else {
				//console.log(require('util').inspect(res, false, 100, true));
				res.writeHead(404, 'Not found. "' + format + '" is not a known image type.');
				res.end();
			}
		} else {
			next();
		}
	}
};