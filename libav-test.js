"use strict";

var path = require('path');
var libav = require('./server/modules/libav');

var src = path.resolve(__dirname, 'data/test/files/afm.f4v');
var dest = path.resolve(__dirname, 'processed.mp4');

var start = new Date().getTime();
//libav(src)
//	.on('progress', function(progress) {
//		//console.log('%s%', progress);
//	})
//	.on('message', function(msg) {
//		//console.log('     %s', msg);
//	})
//	.noAudio()
//	.videoCodec('libx264')
//	.transpose(2)
//	.size(233, 393)
//	.save(dest, function(err, out) {
//		if (err) {
//			console.error('ERROR: %s', err);
//			console.log('OUTPUT:\n%s', out);
//		}
//		console.log('Done in %dms.', new Date().getTime() - start);
//	});

libav(src).probe(function(err, metadata) {
	if (err) {
		return console.error(err);
	}
	console.log(require('util').inspect(metadata));
});