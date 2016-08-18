"use strict";

var _ = require('lodash');
var fs = require('fs');
var gm = require('gm');
var path = require('path');
var async = require('async');
var expect = require('expect.js');
var pleasejs = require('pleasejs');

var mp4 = path.resolve(__dirname, '../../data/test/files/afm.f4v');
var avi = path.resolve(__dirname, '../../data/test/files/afm.avi');
var vpt = path.resolve(__dirname, '../../data/test/files/empty.vpt');
var vpt2 = path.resolve(__dirname, '../../data/test/files/table.vpt');
var rom = path.resolve(__dirname, '../../data/test/files/hulk.zip');
var zip = path.resolve(__dirname, '../../data/test/files/dmd.zip');
var rar = path.resolve(__dirname, '../../data/test/files/dmd.rar');

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

exports.createDirectB2S = function(user, request, gameName, done) {

	if (_.isFunction(gameName)) {
		done = gameName;
		gameName = 'aavenger';
	}

	gm(1280, 1024, pleasejs.make_color()).toBuffer('PNG', function(err, image) {
		if (err) {
			throw err;
		}
		let data = `<B2SBackglassData Version="1.2">
					  <ProjectGUID Value="41664711-BFB7-4911-ABE1-31542BFD0014" />
					  <ProjectGUID2 Value="C29873B0-D97B-4461-91CD-8897167F5CA0" />
					  <AssemblyGUID Value="BF0C830A-6FFB-449C-8770-68E2D3A9FFF3" />
					  <Name Value="VPDB Test" />
					  <VSName Value="VPDB Test.vpt" />
					  <DualBackglass Value="0" />
					  <Author Value="test" />
					  <Artwork Value="test" />
					  <GameName Value="${gameName}" />
					  <TableType Value="3" />
					  <AddEMDefaults Value="0" />
					  <DMDType Value="1" />
					  <CommType Value="1" />
					  <DestType Value="1" />
					  <NumberOfPlayers Value="4" />
					  <B2SDataCount Value="5" />
					  <ReelType Value="" />
					  <UseDream7LEDs Value="1" />
					  <D7Glow Value="0" />
					  <D7Thickness Value="0" />
					  <D7Shear Value="0" />
					  <ReelRollingDirection Value="0" />
					  <ReelRollingInterval Value="0" />
					  <ReelIntermediateImageCount Value="0" />
					  <GrillHeight Value="0" />
					  <DMDDefaultLocationX Value="0" />
					  <DMDDefaultLocationY Value="0" />
					  <Animations />
					  <Scores />
					  <Illumination />
					  <Images>
						<ThumbnailImages>
						  <MainImage Image="iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAAXNSR0IArs4c6QAAAARnQU1BAACx&#xD;&#xA;jwv8YQUAAAAJcEhZcwAADsMAAA7DAcdvqGQAAAAvSURBVFhH7c4hAQAACAMw+tDfvhrEuJmY3+zm&#xD;&#xA;mgQEBAQEBAQEBAQEBAQEBMqB3AOdXkx5NpzLCAAAAABJRU5ErkJggg==" />
						</ThumbnailImages>
						<BackgroundImages>
						  <MainImage Type="0" RomID="0" RomIDType="0" FileName="backlglass.png" Image="${image.toString('base64')}" />
						</BackgroundImages>
						<IlluminatedImages />
						<DMDImages>
						  <MainImage />
						</DMDImages>
					  </Images>
					</B2SBackglassData>`;
		request
			.post('/storage/v1/files')
			.query({ type: 'backglass' })
			.type('application/x-directb2s')
			.set('Content-Disposition', 'attachment; filename="test.directb2s"')
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


exports.createPlayfield = function(user, request, orientation, type, done) {
	if (_.isFunction(type)) {
		done = type;
		type = null;
	}
	exports.createPlayfields(user, request, orientation, 1, type, function(playfields) {
		done(playfields[0]);
	});
};

exports.createPlayfields = function(user, request, orientation, times, type, done) {

	if (_.isFunction(type)) {
		done = type;
		type = null;
	}
	var fileType = type || 'playfield-' + orientation;
	var mimeType = 'image/png';

	var isFS = orientation == 'fs';

	async.times(times, function(n, next) {
		var name = 'playfield-' + n + '.png';

		gm(isFS ? 1080 : 1920, isFS ? 1920 : 1080, pleasejs.make_color()).toBuffer('PNG', function(err, data) {
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
		.set('Content-Disposition', 'attachment; filename="dmd.zip"')
		.set('Content-Length', data.length)
		.send(data)
		.as(user)
		.end(function(err, res) {
			expect(err).to.not.be.ok();
			expect(res.status).to.be(201);
			done(res.body);
		});
};

exports.createRar = function(user, request, done) {
	var data = fs.readFileSync(rar);
	request
		.post('/storage/v1/files')
		.query({ type: 'release' })
		.type('application/rar')
		.set('Content-Disposition', 'attachment; filename="dmd.rar"')
		.set('Content-Length', data.length)
		.send(data)
		.as(user)
		.end(function(err, res) {
			expect(err).to.not.be.ok();
			expect(res.status).to.be(201);
			done(res.body);
		});
};

exports.createMp3 = function(user, request, done) {

	var data ='{binary music data}';
	request
		.post('/storage/v1/files')
		.query({ type: 'release' })
		.type('audio/mp3')
		.set('Content-Disposition', 'attachment; filename="test.mp3"')
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

exports.createVpt = function(user, request, opts, done) {
	if (_.isFunction(opts)) {
		done = opts;
		opts = {};
	}
	exports.createVpts(user, request, 1, opts, function(vpts) {
		done(vpts[0]);
	});
};

exports.createVpts = function(user, request, times, opts, done) {
	if (_.isFunction(opts)) {
		done = opts;
		opts = {};
	}
	var data = opts.alternateVpt ? fs.readFileSync(vpt2) : fs.readFileSync(vpt);
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