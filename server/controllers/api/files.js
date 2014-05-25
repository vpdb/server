var _ = require('underscore');
var fs = require('fs');
var path = require('path');

var api = require('./common');
var File = require('mongoose').model('File');
var config = require('../../modules/settings').current;

exports.upload = function(req, res) {
	api.auth(req, res, 'files', 'upload', function() {

		if (!req.headers['content-type']) {
			return api.fail(res, 'Header "Content-Type" must be provided.', 422);
		}
		if (!req.headers['content-disposition']) {
			return api.fail(res, 'Header "Content-Disposition" must be provided.', 422);
		}
		if (!/filename=([^;\z]+)/i.test(req.headers['content-disposition'])) {
			return api.fail(res, 'Header "Content-Disposition" must contain file name.', 422);
		}
		if (!req.query.type) {
			return api.fail(res, 'Query parameter "type" must be provided.', 422);
		}

		var file = new File({
			name: req.headers['content-disposition'].match(/filename=([^;\z]+)/i)[1].replace(/(^"|^'|"$|'$)/g, ''),
			bytes: req.headers['content-length'],
			created: new Date(),
			author: req.user._id,
			mimeType: req.headers['content-type'],
			fileType: req.query.type
		});

		file.validate(function(err) {
			if (err) {
				return api.fail(res, err, 422);
			}

			file.save(function(err, file) {
				if (err) {
					return api.fail(res, err, 500);
				}
				var writeStream = fs.createWriteStream(path.resolve(config.vpdb.storage, file._id.toString()));
				req.on('data', function (data) {
					writeStream.write(data);
				});
				req.on('end', function() {
					writeStream.end();
					var f = _.pick(file, 'name', 'bytes', 'created', 'mimeType', 'fileType');
					f.url = '/storage/' + file._id;
					api.success(res, f);
				});
			});
		});
	});
};
