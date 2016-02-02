/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

"use strict"; /* global describe, before, after, it */

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var request = require('superagent');
var expect = require('expect.js');

var superagentTest = require('../modules/superagent-test');
var hlp = require('../modules/helper');

superagentTest(request);

describe('When dealing with media', function() {

	describe.only('of a release', function() {

		var game, vptfile;

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] },
				contributor: { roles: [ 'contributor' ] }
			}, function() {
				hlp.game.createGame('contributor', request, function(g) {
					game = g;
					hlp.file.createVpt('member', request, function(v) {
						vptfile = v;
						hlp.doomFile('member', vptfile.id);
						done();
					});
				});
			});
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail when providing a ws playfield for a fs file', function(done) {
			var user = 'member';
			hlp.file.createPlayfield(user, request, 'ws', function(playfield) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: 'release',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'fs', lighting: 'night' } }
								],
								version: '1.0.0'
							}
						],
						authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]

					}).end(function (err, res) {
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'orientation is set to fs');
						done();
					});
			});
		});

		it('should fail when providing a fs playfield for a ws file', function(done) {
			var user = 'member';
			hlp.file.createPlayfield(user, request, 'fs', function(playfield) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: 'release',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'ws', lighting: 'night' } }
								],
								version: '1.0.0'
							}
						],
						authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
					})
					.end(function (err, res) {
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'orientation is set to ws');
						done();
					});
			});
		});

		it('should fail when image orientation for playfield-fs is ws', function(done) {
			var user = 'member';
			hlp.file.createPlayfield(user, request, 'fs', 'playfield-ws', function(playfield) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: 'release',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'ws', lighting: 'night' } }
								],
								version: '1.0.0'
							}
						],
						authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
					})
					.end(function (err, res) {
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'should be portrait');
						done();
					});
			});
		});

		it('should fail when image orientation for playfield-ws is fs', function(done) {
			var user = 'member';
			hlp.file.createPlayfield(user, request, 'fs', 'playfield-ws', function(playfield) {
				request
					.post('/api/v1/releases')
					.as(user)
					.send({
						name: 'release',
						_game: game.id,
						versions: [
							{
								files: [ {
									_file: vptfile.id,
									_media: { playfield_image: playfield.id },
									_compatibility: [ '9.9.0' ],
									flavor: { orientation: 'ws', lighting: 'night' } }
								],
								version: '1.0.0'
							}
						],
						authors: [ { _user: hlp.getUser(user).id, roles: [ 'Table Creator' ] } ]
					})
					.end(function (err, res) {
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'should be portrait');
						done();
					});
			});
		});


	});
});