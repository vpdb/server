var _ = require('underscore');
var logger = require('winston');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');
var fileRef = require('../models/plugins/fileRef');

var storage = require('../modules/storage');

var Schema = mongoose.Schema;

var gameTypes = [ 'ss', 'em', 'pm', 'og', 'na'];

var maxAspectRatioDifference = 0.2;

// schema
var fields = {
	id:             { type: String, required: 'Game ID must be provided.', unique: true },
	title:          { type: String, required: 'Title must be provided.', index: true },
	year:           { type: Number, required: 'Year must be provided.', index: true },
	manufacturer:   { type: String, required: 'Manufacturer must be provided.', index: true },
	game_type:      { type: String, required: true, enum: { values: gameTypes, message: 'Invalid game type. Valid game types are: ["' +  gameTypes.join('", "') + '"].' }},
	short:          Array,
	description:    String,
	instructions:   String,
	produced_units: Number,
	model_number:   String,
	themes:         Array,
	designers:      Array,
	artists:        Array,
	features:       String,
	notes:          String,
	toys:           String,
	slogans:        String,
	ipdb: {
		number: Number,
		rating: Number,
		mfg: Number
	},
	media: {
		backglass: { type: Schema.ObjectId, ref: 'File', required: 'Backglass image must be provided.' },
		logo:      { type: Schema.ObjectId, ref: 'File' }
	}
};

// what's returned in the API
var apiFields = {
	simple: [ 'id', 'title', 'manufacturer', 'year', 'game_type', 'ipdb', 'media' ] // fields returned in lists
};

var GameSchema = new Schema(fields);

// validations
GameSchema.path('game_type').validate(function(gameType, callback) {

	var ipdb = this.ipdb ? this.ipdb.number : null;

	// only check if not an original game.
	if (this.game_type != 'og' && (!ipdb || !validator.isInt(ipdb))) {
		this.invalidate('ipdb.number', 'IPDB Number is mandatory for recreations and must be a postive integer.');
		return callback(true);
	}

	var that = this;
	if (this.game_type != 'og') {
		mongoose.model('Game').findOne({ 'ipdb.number': ipdb }, function(err, g) {
			if (err) {
				logger.error('[model|game] Error fetching game %s.');
				return callback(false);
			}
			if (g) {
				that.invalidate('ipdb.number', 'The game "' + g.title + '" is already in the database and cannot be added twice.');
			}
			callback();
		});
	}
});

// validations
GameSchema.path('media.backglass').validate(function(backglass, callback) {

	if (!backglass) {
		return;
	}

	mongoose.model('File').findOne({ _id: backglass }, function(err, backglass) {
		if (err) {
			logger.error('[model|game] Error fetching backglass %s.');
			return callback(false);
		}

		var ar = Math.round(backglass.metadata.size.width / backglass.metadata.size.height * 1000) / 1000;
		var arDiff = Math.abs(ar / 1.25 - 1);
		callback(arDiff < maxAspectRatioDifference);
	});
}, 'Aspect ratio of backglass must be smaller than 1:1.5 and greater than 1:1.05.');

// methods
GameSchema.methods = {

	/**
	 * Returns the URL of the file.
	 *
	 * @return {String}
	 * @api public
	 */
	getUrl: function() {
		return '/game/' + this.id;
	},

	getMedia: function() {
		return {
			backglass: {
				url: storage.url(game.media.backglass),
				variations: storage.urls(game.media.backglass)
			},
			logo: {
				url: storage.url(game.media.logo),
				variations: storage.urls(game.media.logo)
			}
		};
	},

	toSimple: function() {
		return _.pick(this.toObject(), apiFields.simple);
	},

	toDetailed: function() {
		return this.toObject();
	}
};

GameSchema.set('toObject', { virtuals: true });
if (!GameSchema.options.toObject) {
	GameSchema.options.toObject = {};
}
GameSchema.options.toObject.transform = function(doc, game) {
	delete game._id;
	delete game.__v;
//	game.url = game.getUrl();
//	game.media = game.getMedia();
};


// plugins
GameSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });
GameSchema.plugin(fileRef, { model: 'Game', fields: [ 'media.backglass', 'media.logo' ]});

mongoose.model('Game', GameSchema);
logger.info('[model] Model "game" registered.');
