module.exports = function(opts) {

	opts = opts || {};
	opts.absolute = opts.absolute !== false;
	opts.noext = opts.noext === true;

	return function (files, metalsmith, done) {
		for (var filepath in files) {
			if (files.hasOwnProperty(filepath)) {
				var link = (opts.absolute ? '/' : '') + filepath.replace(/\\/g, '/');
				if (opts.permalinks) {
					link = link.replace(/\/[^\/]+$/, '');
				}
				if (opts.noext) {
					link = link.replace(/\.[^\.]+$/, '');
				}
				files[filepath].link = link;
			}
		}
		done();
	};
};
