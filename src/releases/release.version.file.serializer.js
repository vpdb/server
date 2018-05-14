/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

const _ = require('lodash');
const Serializer = require('../common/serializer');
const BuildSerializer = require('../../src_/serializers/build.serializer');
const FileSerializer = require('../files/file.serializer');
const UserSerializer = require('../users/user.serializer');

class ReleaseVersionFileSerializer extends Serializer {

	/** @protected */
	_simple(doc, req, opts) {
		return this._serialize(doc, req, opts, BuildSerializer.reduced.bind(BuildSerializer), FileSerializer.simple.bind(FileSerializer));
	}

	/** @protected */
	_detailed(doc, req, opts) {
		const versionFile = this._serialize(doc, req, opts, BuildSerializer.simple.bind(BuildSerializer), FileSerializer.detailed.bind(FileSerializer));

		// media
		if (this._populated(doc, '_playfield_image')) {
			versionFile.playfield_image = FileSerializer.detailed(doc._playfield_image, req, opts);
		}
		if (doc._playfield_video && this._populated(doc, '_playfield_video')) {
			versionFile.playfield_video = FileSerializer.detailed(doc._playfield_video, req, opts);
		}

		return versionFile;
	}

	/** @protected */
	_serialize(doc, req, opts, buildSerializer, fileSerializer) {
		const versionFile = {
			flavor: doc.flavor.toObject(),
			counter: doc.counter.toObject(),
			released_at: doc.released_at
		};

		// file
		if (this._populated(doc, '_file')) {
			versionFile.file = fileSerializer(doc._file, req, opts);
		}

		// compat
		if (this._populated(doc, '_compatibility')) {
			versionFile.compatibility = doc._compatibility.map(build => buildSerializer(build, req, opts));
		}

		// validation
		if (doc.validation && doc.validation.status) {
			versionFile.validation = {
				status: doc.validation.status,
				message: doc.validation.message,
				validated_at: doc.validation.validated_at,
				validated_by: this._populated(doc, 'validation._validated_by') ? UserSerializer.reduced(doc.validation._validated_by, req, opts) : undefined
			};
		}

		// thumb
		if (opts.thumbPerFile && opts.thumbFormat) {
			versionFile.thumb = this._getFileThumb(doc, req, opts);
		}

		return versionFile;
	}
}

module.exports = new ReleaseVersionFileSerializer();
