"use strict";

const _ = require('lodash');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const basename = require('path').basename;

exports.upload = function(config) {

	config = config || {};
	const apiUri = config.apiUri || 'http://localhost:3000/api/v1';
	const storageUri = config.storageUri || 'http://localhost:3000/storage/v1';
	const authHeader = config.authHeader || 'Authorization';
	const credentials = config.credentials || {};
	const romFolder = config.romFolder || 'roms';

	const games = require('./roms.json');

	let apiConfig = { baseURL: apiUri, timeout: 1000, headers: {}};
	let storageConfig = { baseURL: storageUri, timeout: 1000, headers: {}};
	if (config.httpSimple) {
		apiConfig.headers.Authorization = 'Basic ' + new Buffer(config.httpSimple.username + ':' + config.httpSimple.password).toString('base64');
		storageConfig.headers.Authorization = 'Basic ' + new Buffer(config.httpSimple.username + ':' + config.httpSimple.password).toString('base64');
	}
	let apiClient = axios.create(apiConfig);
	let storageClient;

	return Promise.try(() => {

		// authenticate
		return apiClient.post('/authenticate', credentials).catch(response => {
			throw new Error(response.data.error);
		});

	}).then(response => {

		apiConfig.headers[authHeader] = 'Bearer ' + response.data.token;
		storageConfig.headers[authHeader] = 'Bearer ' + response.data.token;

		apiClient = axios.create(apiConfig);
		storageClient = axios.create(storageConfig);

		// for each game...
		return Promise.each(games, game => {

			// retrieve existing ROMs for game
			console.log('Retrieving ROMs for "%s (%s %s)"', game.title, game.manufacturer, game.year);
			let skippedRoms, uploadedRoms, missingRoms;
			return apiClient.get('/roms?per_page=100&ipdb_number=' + game.ipdb.number).then(response => {
				let existingRoms = [];
				if (!_.isEmpty(response.data)) {
					existingRoms = response.data.map(r => r.id + '.zip');
					console.log('   *** Existing ROMs: %j', existingRoms);
				}
				skippedRoms = [];
				uploadedRoms = [];
				missingRoms = [];

				// for each rom
				return Promise.each(game.roms, rom => {
					if (_.includes(existingRoms, rom.filename)) {
						return skippedRoms.push(rom.filename);
					}
					let localPath = path.resolve(romFolder, rom.filename);
					if (!fs.existsSync(localPath)) {
						return missingRoms.push(rom.filename);
					}

					// upload file
					console.log('   --- Uploading %s...', localPath);
					let romContent = fs.readFileSync(localPath);
					return storageClient.post('/files?type=rom', romContent, {
						headers: {
							'Content-Type': 'application/zip',
							'Content-Disposition': 'attachment; filename="' + rom.filename + '"',
							'Content-Length': romContent.length
						}
					}).then(response => {

						// post rom data
						let uploadedFile = response.data;
						return apiClient.post('/roms', {
							_file: uploadedFile.id,
							_ipdb_number: game.ipdb.number,
							id: basename(rom.filename.toLowerCase(), '.zip'),
							version: rom.version,
							notes: rom.notes,
							languages: rom.languages
						});

					}).then(response => {
						let uploadedRom = response.data;
						console.log('   --- Uploaded ROM with ID "%s" created!', uploadedRom.id);
						uploadedRoms.push(rom.filename);
					});

				}).then(() => {
					// log
					if (!_.isEmpty(skippedRoms)) {
						console.log('   *** Skipped ROMs:  %j', skippedRoms.sort());
					}
					if (!_.isEmpty(uploadedRoms)) {
						console.log('   *** Uploaded ROMs: %j', uploadedRoms.sort());
					}
					if (!_.isEmpty(missingRoms)) {
						console.log('   *** Missing ROMs: %j', missingRoms.sort());
					}
				});
			});
		});

	}).catch(err => {
		if (err.data && err.data.error) {
			throw new Error(err.data.error);
		}
		if (err.data && err.data.errors) {
			throw new Error('Validation error for field "' + err.data.errors[0].field + '": ' + err.data.errors[0].message);
		}
	});
};
