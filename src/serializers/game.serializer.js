const _ = require('lodash');
const ipdb = require('../modules/ipdb');
const Serializer = require('./serializer');
const FileSerializer = require('./file.serializer');
const config = require('../modules/settings').current;

class GameSerializer extends Serializer {

	/** @protected */
	_reduced(doc, req, opts) {
		return _.pick(doc, ['id', 'title', 'manufacturer', 'year', 'ipdb']);
	}

	/** @protected */
	_simple(doc, req, opts) {
		const game = this._reduced(doc, req, opts);
		_.assign(game, _.pick(doc, ['game_type', 'backglass', 'logo', 'counter', 'rating']));

		// restrictions
		const restrictions = {};
		if (config.vpdb.restrictions.release.denyMpu.includes(doc.ipdb.mpu)) {
			restrictions.release = { mpu: true };
		}
		if (config.vpdb.restrictions.backglass.denyMpu.includes(doc.ipdb.mpu)) {
			restrictions.backglass = { mpu: true };
		}
		if (config.vpdb.restrictions.rom.denyMpu.includes(doc.ipdb.mpu)) {
			restrictions.rom = { mpu: true };
		}
		if (!_.isEmpty(restrictions)) {
			game.restrictions = restrictions;
		}

		// mpu
		if (doc.ipdb.mpu && ipdb.systems[doc.ipdb.mpu]) {
			game.mpu = ipdb.systems[doc.ipdb.mpu];
		}

		// backglass
		if (doc.populated('_backglass')) {
			game.backglass = FileSerializer.simple(doc._backglass, req, opts);
		}

		// logo
		if (doc.populated('_logo')) {
			game.logo = FileSerializer.simple(doc._logo, req, opts);
		}

		return game;
	}

	/** @protected */
	_detailed(doc, req, opts) {
		const game = this._simple(doc, req, opts);
		game.owner = ipdb.owners[doc.ipdb.mfg] || doc.manufacturer;
		return game;
	}
}

module.exports = new GameSerializer();