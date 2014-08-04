"use strict";

var _ = require('underscore');
var async = require('async');
var logger = require('winston');
var mongoose = require('mongoose');
var objectPath = require('object-path');

var storage = require('../../modules/storage');

module.exports = exports = function(schema, options) {

	if (!options || !options.model) {
		throw new Error('Fileref plugin needs model. Please provide.');
	}
	if (!options.fields || !_.isArray(options.fields)) {
		throw new Error('Fileref plugin needs file reference fields. Please provide.');
	}

	/**
	 * Replaces API IDs with database IDs and returns a new instance of the
	 * configured model.
	 *
	 * @param obj Object, directly from API client
	 * @param callback Called with (`err`, `ModelInstance`)
	 */
	schema.statics.getInstance = function(obj, callback) {

		var Model = mongoose.model(options.model);
		var File = mongoose.model('File');

		var shortIds = [];
		_.each(options.fields, function(path) {
			var shortId = objectPath.get(obj, path);
			if (shortId) {
				shortIds.push(shortId);
			}
		});
		var invalidations = [];

		// find files with submitted shortIds
		File.find({ id: { $in: shortIds }}, function(err, files) {
			if (err) {
				logger.error('[model] Error finding referenced files: %s', err);
				return callback(err);
			}
			_.each(options.fields, function(path) {
				var hit = false;
				var shortId = objectPath.get(obj, path);
				_.each(files, function(file) {

					// if match, switch shortId with _id
					if (file.id === shortId) {
						objectPath.set(obj, path, file._id);
						hit = true;
					}
				});
				// no match, add invalidation
				if (!hit) {
					if (shortId) {
						logger.warn('[model] File ID %s not found in database for field %s.', objectPath.get(obj, path), path);
						invalidations.push({ path: path, message: 'No such file with ID "' + objectPath.get(obj, path) + '".' });
						objectPath.set(obj, path, '000000000000000000000000');
					}
				}
			});
			var model = new Model(obj);

			// for invalid IDs, invalidate instantly so we can provide which value is wrong.
			_.each(invalidations, function(invalidation) {
				model.invalidate(invalidation.path, invalidation.message);
			});
			callback(null, model);
		});
	};

	/**
	 * Sets the referenced files to active. Call this after creating a new
	 * instance.
	 *
	 * @param done (`err`)
	 * @returns {*}
	 */
	schema.methods.activateFiles = function(done) {

		var File = mongoose.model('File');

		var ids = [];
		var obj = this;
		_.each(options.fields, function(path) {
			var id = objectPath.get(obj, path);
			if (id) {
				ids.push(id);
			}
		});
		File.find({ _id: { $in: ids }}, function(err, files) {
			if (err) {
				logger.error('[model] Error finding referenced files: %s', err);
				return done(err);
			}

			// update
			async.each(files, function(file, next) {
				var publc = false;
				switch (file.getMimeType()) {
					case 'image':
					case 'text':
						publc = true;
						break;
				}
				file.is_active = true;
				file.is_public = publc;
				file.save(next);
			}, function(err) {
				if (err) {
					return done(err);
				}
				obj.populate(options.fields.join(' '), done);
			});
		});
		return this;
	};

	/**
	 * Physically remove the files from the disk
	 */
	schema.post('remove', function(obj, done) {

		var File = mongoose.model('File');

		var ids = [];
		_.each(options.fields, function(path) {
			var id = objectPath.get(obj, path);
			if (id) {
				ids.push(id);
			}
		});
		File.find({ _id: { $in: ids }}, function(err, files) {
			if (err) {
				logger.error('[model] Error finding referenced files: %s', err);
				return done(err);
			}

			_.each(files, function(file) {
				storage.remove(file);
			});
			done();
		});
	});
};
