var _ = require('underscore');
var logger = require('winston');
var mongoose = require('mongoose');
var validator = require('validator');
var uniqueValidator = require('mongoose-unique-validator');

var Schema = mongoose.Schema;

var gameTypes = [ 'ss', 'em', 'pm', 'og', 'na'];

// schema
var fields = {
	gameId:        { type: String, required: 'Game ID must be provided.', index: true, unique: true },
	title:         { type: String, required: 'Title must be provided.', index: true },
	year:          { type: Number, required: 'Year must be provided.', index: true },
	manufacturer:  { type: String, required: 'Manufacturer must be provided.', index: true },
	gameType:      { type: String, required: true, enum: { values: gameTypes, message: 'Invalid game type. Valid game types are: ["' +  gameTypes.join('", "') + '"].' }},
	short:         Array,
	description:   String,
	instructions:  String,
	producedUnits: Number,
	modelNumber:   String,
	themes:        Array,
	designers:     Array,
	artists:       Array,
	features:      String,
	notes:         String,
	toys:          String,
	slogans:       String,
	ipdb: {
		number: Number,
		rating: Number,
		mfg: Number
	},
	media: {
		backglass: { type: Schema.Types.ObjectId, ref: 'File', required: 'Backglass image must be provided.' },
		logo: { type: Schema.Types.ObjectId, ref: 'File' }
	}
};
var GameSchema = new Schema(fields);

GameSchema.plugin(uniqueValidator, { message: 'The {PATH} "{VALUE}" is already taken.' });

// validations
GameSchema.path('gameType').validate(function(gameType) {

	var ipdb = this.ipdb ? this.ipdb.number : null;

	// only check if not an original game.
	if (this.gameType != 'og' && (!ipdb || !validator.isInt(ipdb))) {
		this.invalidate('ipdb.number', 'IPDB Number is mandatory for recreations and must be a postive integer.');
	}
	return true;
});


// methods
GameSchema.methods = {

	/**
	 * Returns the URL of the file.
	 *
	 * @return {String}
	 * @api public
	 */
	getUrl: function() {
		return '/game/' + this.gameId;
	}
};

mongoose.model('Game', GameSchema);
logger.info('[model] Model "game" registered.');
