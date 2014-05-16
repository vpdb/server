var _ = require('underscore');


exports.success = function(res, result, code) {
	if (!code) {
		code = 200;
	}
	res.setHeader('Content-Type', 'application/json');
	res.status(code).json(_.omit(result, '__v'));
};

exports.fail = function(res, err, code) {
	if (!code) {
		code = 500;
	}
	res.setHeader('Content-Type', 'application/json');
	if (err.errors) {
		var arr = [];
		_.each(err.errors, function(error) {
			arr.push({
				message: error.message,
				field: error.path,
				value: error.value
			});
		});
		res.status(code).json({ errors: arr });
	} else {
		res.status(code).json({ error: err instanceof Error ? err.message : err });
	}
};

exports.checkApiContentType = function(req, res, next) {
	if (req.path.substr(0, 5) == '/api/' && req.get('content-type') != 'application/json') {
		res.setHeader('Content-Type', 'application/json');
		res.status(415).json({ error: 'Sorry, the API only talks JSON. Did you forget to set your "Content-Type" header correctly?' });
	} else {
		next(req, res, next);
	}
};

exports.handleParseError = function(err, req, res, next) {
	if (err instanceof SyntaxError && req.get('content-type') == 'application/json' && req.path.substr(0, 5) == '/api/') {
		res.setHeader('Content-Type', 'application/json');
		res.status(400).json({ error: 'Parsing error: ' + err.message });
	} else {
		next(err, req, res, next);
	}
};
