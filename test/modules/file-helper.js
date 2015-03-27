"use strict";

var fs = require('fs');
var gm = require('gm');
var path = require('path');
var async = require('async');
var expect = require('expect.js');
var pleasejs = require('pleasejs');

var mp4 = path.resolve(__dirname, '../../data/test/files/afm.f4v');
var avi = path.resolve(__dirname, '../../data/test/files/afm.avi');
var vpt = path.resolve(__dirname, '../../data/test/files/empty.vpt');
var rom = path.resolve(__dirname, '../../data/test/files/hulk.zip');
var zip = path.resolve(__dirname, '../../data/test/files/empty.zip');

exports.createBackglass = function(user, request, done) {

	var fileType = 'backglass';
	var mimeType = 'image/png';
	var name = 'backglass.png';
	gm(640, 512, pleasejs.make_color()).toBuffer('PNG', function(err, data) {
		if (err) {
			throw err;
		}
		request
			.post('/storage/v1/files')
			.query({ type: fileType })
			.type(mimeType)
			.set('Content-Disposition', 'attachment; filename="' + name + '"')
			.set('Content-Length', data.length)
			.send(data)
			.as(user)
			.end(function(err, res) {
				expect(err).to.not.be.ok();
				expect(res.status).to.be(201);
				done(res.body);
			});
	});
};

exports.createPlayfield = function(user, request, done) {
	exports.createPlayfields(user, request, 1, function(playfields) {
		done(playfields[0]);
	});
};

exports.createPlayfields = function(user, request, times, done) {

	var fileType = 'playfield-fs';
	var mimeType = 'image/png';

	async.times(times, function(n, next) {
		var name = 'playfield-' + n + '.png';

		gm(1920, 1080, pleasejs.make_color()).toBuffer('PNG', function(err, data) {
			if (err) {
				throw err;
			}
			request
				.post('/storage/v1/files')
				.query({ type: fileType })
				.type(mimeType)
				.set('Content-Disposition', 'attachment; filename="' + name + '"')
				.set('Content-Length', data.length)
				.send(data)
				.as(user)
				.end(function(err, res) {
					expect(err).to.not.be.ok();
					expect(res.status).to.be(201);
					next(null, res.body);
				});
		});

	}, function(err, playfields) {
		done(playfields);
	});
};

exports.createTextfile = function(user, request, done) {
	var fileType = 'release';
	request
		.post('/storage/v1/files')
		.query({ type: fileType })
		.type('text/plain')
		.set('Content-Disposition', 'attachment; filename="README.txt"')
		.send('You are looking at a text file generated during a test.')
		.as(user)
		.end(function(err, res) {
			expect(err).to.not.be.ok();
			expect(res.status).to.be(201);
			done(res.body);
		});
};

exports.createZip = function(user, request, done) {
	var data = fs.readFileSync(zip);
	request
		.post('/storage/v1/files')
		.query({ type: 'release' })
		.type('application/zip')
		.set('Content-Disposition', 'attachment; filename="empty.zip"')
		.set('Content-Length', data.length)
		.send(data)
		.as(user)
		.end(function(err, res) {
			expect(err).to.not.be.ok();
			expect(res.status).to.be(201);
			done(res.body);
		});
};

exports.createMp4 = function(user, request, done) {

	var data = fs.readFileSync(mp4);
	request
		.post('/storage/v1/files')
		.query({ type: 'playfield-fs' })
		.type('video/mp4')
		.set('Content-Disposition', 'attachment; filename="playfield.mp4"')
		.set('Content-Length', data.length)
		.send(data)
		.as(user)
		.end(function(err, res) {
			expect(err).to.not.be.ok();
			expect(res.status).to.be(201);
			done(res.body);
		});
};

exports.createAvi = function(user, request, done) {

	var data = fs.readFileSync(avi);
	request
		.post('/storage/v1/files')
		.query({ type: 'playfield-fs' })
		.type('video/avi')
		.set('Content-Disposition', 'attachment; filename="playfield.avi"')
		.set('Content-Length', data.length)
		.send(data)
		.as(user)
		.end(function(err, res) {
			expect(err).to.not.be.ok();
			expect(res.status).to.be(201);
			done(res.body);
		});
};


exports.createRom = function(user, request, done) {

	var data = fs.readFileSync(rom);
	request
		.post('/storage/v1/files')
		.query({ type: 'rom' })
		.type('application/zip')
		.set('Content-Disposition', 'attachment; filename="hulk.zip"')
		.set('Content-Length', data.length)
		.send(data)
		.as(user)
		.end(function(err, res) {
			expect(err).to.not.be.ok();
			expect(res.status).to.be(201);
			done(res.body);
		});
};

exports.createVpt = function(user, request, done) {
	exports.createVpts(user, request, 1, function(vpts) {
		done(vpts[0]);
	});
};

exports.createVpts = function(user, request, times, done) {

	var data = fs.readFileSync(vpt);
	async.times(times, function(n, next) {
		request
			.post('/storage/v1/files')
			.query({ type: 'release' })
			.type('application/x-visual-pinball-table')
			.set('Content-Disposition', 'attachment; filename="test-table-' + n + '.vpt"')
			.set('Content-Length', data.length)
			.send(data)
			.as(user)
			.end(function(err, res) {
				expect(err).to.not.be.ok();
				expect(res.status).to.be(201);
				next(null, res.body);
			});
	}, function(err, vpts) {
		done(vpts);
	});

};