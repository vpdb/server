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

describe('The VPDB `release` API', function() {

	describe('when posting a new release', function() {

		before(function(done) {
			hlp.setupUsers(request, {
				member: { roles: [ 'member' ] }
			}, done);
		});

		after(function(done) {
			hlp.cleanup(request, done);
		});

		it('should fail validations for empty release', function(done) {
			request
				.post('/api/v1/releases')
				.as('member')
				.send({})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'name', 'must be provided');
					hlp.expectValidationError(err, res, 'versions', 'at least one version');
					hlp.expectValidationError(err, res, 'authors', 'at least one author');
					done();
				});
		});

		it('should fail validations for empty version', function(done) {
			request
				.post('/api/v1/releases')
				.as('member')
				.send({ versions: [ {} ]})
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'versions.0.version', 'must be provided');
					hlp.expectValidationError(err, res, 'versions.0.files', 'at least one');
					done();
				});
		});

		it('should fail validations for empty file', function(done) {
			request
				.post('/api/v1/releases')
				.as('member')
				.send({ versions: [ {
					files: [ {} ]
				} ] })
				.end(function(err, res) {
					hlp.expectValidationError(err, res, 'versions.0.files.0._file', 'must provide a file reference');
					hlp.expectNoValidationError(err, res, 'versions.0.files.0.flavor.orientation');
					hlp.expectNoValidationError(err, res, 'versions.0.files.0.flavor.lightning');
					hlp.expectNoValidationError(err, res, 'versions.0.files.0._media.playfield_image');
					done();
				});
		});

		it('should fail validations when providing valid file reference', function(done) {
			hlp.file.createVpt('member', request, function(vptfile) {
				request
					.post('/api/v1/releases')
					.as('member')
					.send({ versions: [ {
						files: [
							{ _file: vptfile.id },
							{ _file: vptfile.id, flavor: {} },
							{ _file: vptfile.id, flavor: { orientation: 'invalid' } }
						]
					} ] })
					.end(function(err, res) {

						hlp.doomFile('member', vptfile.id);
						hlp.dump(res);
						hlp.expectValidationError(err, res, 'versions.0.files.0.flavor.orientation', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.0.flavor.lightning', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.1.flavor.orientation', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.1.flavor.lightning', 'must be provided');
						hlp.expectValidationError(err, res, 'versions.0.files.2.flavor.orientation', 'invalid orientation');
						hlp.expectValidationError(err, res, 'versions.0.files.0._media.playfield_image', 'must be provided');
						done();
					});
			});
		});


	});
});