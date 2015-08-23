"use strict";

var _ = require('lodash');
var fs = require('fs');
var path = require('path');
var async = require('async');
var request = require('superagent');

exports.upload = function(config) {

	config = config || {};
	var apiUri = config.apiUri || 'http://localhost:3000/api/v1';
	var storageUri = config.storageUri || 'http://localhost:3000/storage/v1';
	var authHeader = config.authHeader || 'Authorization';
	var credentials = config.credentials || {};
	var romFolder = config.romFolder || 'roms';

	if (config.httpSimple) {
		var httpSimple = 'Basic ' + new Buffer(config.httpSimple.username + ':' + config.httpSimple.password).toString('base64');
	}

	var token;
	var requests = [];

	// authenticate
	requests.push(function(next) {
		var headers = {};
		if (httpSimple) {
			headers.Authorization = httpSimple;
		}
		request
			.post(apiUri + '/authenticate')
			.set(headers)
			.send(credentials)
			.end(function(err, res) {
				if (err) {
					console.error('Error obtaining token: %s', err);
					return next(err);
				}
				if (res.status !== 200) {
					console.error('Error obtaining token: %j', res.body);
					return next(new Error(res.body));
				}
				console.log('Authentication successful.');
				token = res.body.token;
				next();
			});
	});

	_.each(exports.data, function(roms, game) {
		_.each(roms, function(rom, id) {
			var filename = path.resolve(romFolder, id + '.zip');
			if (fs.existsSync(filename)) {

				requests.push(function(next) {

					console.log("Uploading %s...", id);

					// post ROM
					var romContent = fs.readFileSync(filename);
					var headers = {
						'Content-Disposition': 'attachment; filename="' + id + '.zip"',
						'Content-Length': romContent.length
					};
					headers[authHeader] = 'Bearer ' + token;
					if (httpSimple) {
						headers.Authorization = httpSimple;
					}
					request
						.post(storageUri + '/files')
						.query({type: 'rom'})
						.type('application/zip')
						.set(headers)
						.send(romContent)
						.end(function(err, res) {

							if (res.status !== 201) {
								console.error('-------------------------------------------------------------------------');
								console.error(res.body);
								console.error('-------------------------------------------------------------------------');
								return next();
							}

							var data = {
								_file: res.body.id,
								id: id,
								version: rom.version,
								notes: rom.notes,
								language: rom.language
							};

							var headers = {};
							headers[authHeader] = 'Bearer ' + token;
							if (httpSimple) {
								headers.Authorization = httpSimple;
							}

							// post data
							request
								.post(apiUri + '/games/' + game + '/roms')
								.type('application/json')
								.set(headers)
								.send(data)
								.end(function(err, res) {
									if (res.status !== 201) {
										console.error('-------------------------------------------------------------------------');
										console.error(res.body);
										console.error('-------------------------------------------------------------------------');
										request.del(apiUri + '/files/' + data._file).set(headers).end(function() {
											next();
										});
									} else {
										next();
									}
								});

						});
				});

			} else {
				console.error('Cannot find ROM "%s".', filename);
			}
		});
	});

	async.series(requests, function(err) {
		console.log('all done!');
	});

};


exports.data = {
	afm: {
		afm_10: {version: '1.0'},
		afm_11: {version: '1.1'},
		afm_113: {version: '1.13'},
		afm_113b: {version: '1.13b'},
		afm_11u: {version: '1.1', notes: 'Ultrapin'},
		afm_f10: {version: '0.10', notes: 'FreeWPC'},
		afm_f20: {version: '0.20', notes: 'FreeWPC'},
		afm_f32: {version: '0.32', notes: 'FreeWPC'}
	},
	'alien-star': {
		alienstr: {version: '1.0'}
	},
	bttf: {
		bttf_a20: {version: '2.0'},
		bttf_a21: {version: '2.1'},
		bttf_a27: {version: '2.7'},
		bttf_g27: {version: '2.7', language: 'de'}
	},
	bbb: {
		bbb108: {version: '1.08'},
		bbb109: {version: '1.09'}
	},
	bc: {
		bcats_l2: {version: 'L-2'},
		bcats_l5: {version: 'L-5'}
	},
	banzai: {
		bnzai_l1: {version: 'L-1'},
		bnzai_l3: {version: 'L-3'},
		bnzai_g3: {version: 'L-3', language: 'de'},
		bnzai_p1: {version: 'P-1'},
		bnzai_pa: {version: 'P-A'}
	},
	bk2k: {
		bk2k_l4: {version: 'L-4'},
		bk2k_la2: {version: 'LA-2'},
		bk2k_lg1: {version: 'L-1', language: 'de'},
		bk2k_lg3: {version: 'L-3', language: 'de'},
		bk2k_pa7: {version: 'PA-7'},
		bk2k_pu1: {version: 'PU-1'}
	},
	br: {
		br_l1: {version: 'L-1'},
		br_l3: {version: 'L-3'},
		br_l4: {version: 'L-4'},
		br_p17: {version: 'SP-1'}
	},
	drac: {
		drac_l1: {version: 'L-1'},
		drac_p11: {version: 'P-11'}
	},
	cc: {
		cc_10: {version: '1.0'},
		cc_104: {version: '1.04', notes: 'Test 0.2'},
		cc_12: {version: '1.2'},
		cc_13: {version: '1.3'},
		cc_13k: {version: '1.3k', notes: 'Adds support for a real knocker'}
	},
	centaur: {
		centaur: {},
		centaura: {version: '1', notes: 'Free play'},
		centaurb: {version: '27', notes: 'Free play'}
	},
	cv: {
		cv_10: {version: '1.0'},
		cv_11: {version: '1.1'},
		cv_13: {version: '1.3'},
		cv_14: {version: '1.4'},
		cv_20h: {version: '2.0h'}
	},
	congo: {
		congo_11: {version: '1.1'},
		congo_13: {version: '1.3'},
		congo_20: {version: '2.0'},
		congo_21: {version: '2.1'}
	},
	cftbl: {
		cftbl_l3: {version: 'L-3'},
		cftbl_l4: {version: 'L-4'},
		cftbl_p3: {version: 'P-3'}
	},
	cyclone: {
		cycln_l1: {version: 'L-1'},
		cycln_l4: {version: 'L-4'},
		cycln_l5: {version: 'L-5'}
	},
	dm: {
		dm_dt099: {version: '0.99', notes: 'FreeWPC Demolition Time by James Cardona'},
		dm_h5: {version: 'H-5'},
		dm_h5b: {version: 'H-5', notes: 'Coin Play'},
		dm_h6: {version: 'H-6'},
		dm_h6b: {version: 'H-6', notes: 'Coin Play'},
		dm_la1: {version: 'L-1'},
		dm_lx3: {version: 'L-3'},
		dm_lx4: {version: 'L-4'},
		dm_pa2: {version: 'P-2'},
		dm_px5: {version: 'P-5'}
	},
	diner: {
		diner_l1: {version: 'L-1'},
		diner_l3: {version: 'L-3'},
		diner_l4: {version: 'L-4'}
	},
	'dr-dude': {
		dd_l2: {version: 'L-2'},
		dd_p06: {version: 'PA-6', notes: 'WPC'},
		dd_p6: {version: 'P-6'},
		dd_p7: {version: 'PA-7', notes: 'WPC'}
	},
	dw: {
		dw_l1: {version: 'L-1'},
		dw_l2: {version: 'L-2'},
		dw_p5: {version: 'P-5'}
	},
	elvis: {
		elv302: {version: '3.02'},
		elv302f: {version: '3.02', language: 'fr'},
		elv302g: {version: '3.02', language: 'de'},
		elv302i: {version: '3.02', language: 'it'},
		elv302l: {version: '3.02', language: 'es'},
		elv303: {version: '3.03', language: 'fr'},
		elv303f: {version: '3.03', language: 'fr'},
		elv303g: {version: '3.03', language: 'de'},
		elv303i: {version: '3.03', language: 'it'},
		elv303l: {version: '3.03', language: 'es'},
		elv400: {version: '4.00', language: 'fr'},
		elv400f: {version: '4.00', language: 'fr'},
		elv400g: {version: '4.00', language: 'de'},
		elv400i: {version: '4.00', language: 'it'},
		elv400l: {version: '4.00', language: 'es'},
		elvis: {version: '5.00'},
		elvisf: {version: '5.00', language: 'fr'},
		elvisg: {version: '5.00', language: 'de'},
		elvisi: {version: '5.00', language: 'it'},
		elvisl: {version: '5.00', language: 'es'}
	},
	es: {
		esha_la1: {version: 'L-1'},
		esha_la3: {version: 'L-3'},
		esha_lg1: {version: 'L-1', language: 'de'},
		esha_lg2: {version: 'L-2', language: 'de'},
		esha_ma3: {version: 'M-3', notes: 'Metallica'},
		esha_pa1: {version: 'P-1'},
		esha_pr4: {version: 'PR-4', notes: 'Family ROM'}
	},
	eatpm: {
		eatpm_4g: {version: 'L-4', language: 'de'},
		eatpm_4u: {version: 'L-4U'},
		eatpm_l1: {version: 'L-1'},
		eatpm_l2: {version: 'L-2'},
		eatpm_l4: {version: 'L-1'},
		eatpm_p7: {version: 'P-7'}
	},
	firepower: {
		frpwr_a6: {version: '31', notes: 'System 6 - 6-digit custom'},
		frpwr_a7: {version: '31', notes: 'System 7 - 6-digit custom'},
		frpwr_b6: {version: '31', notes: 'System 6 - 7-digit'},
		frpwr_b7: {version: '31', notes: 'System 7 - 7-digit'},
		frpwr_c6: {version: '31', notes: 'System 6 - 7-digit custom'},
		frpwr_c7: {version: '38', notes: 'System 7 - 7-digit custom'},
		frpwr_d6: {version: '31', notes: 'System 6 - 6-digit/10 scoring'},
		frpwr_d7: {version: '31', notes: 'System 7 - 7-digit custom'},
		frpwr_e7: {version: '31', notes: 'System 7 - 6-digit/10 scoring'},
		frpwr_l2: {version: 'L-2'},
		frpwr_l6: {version: 'L-6'},
		frpwr_t6: {version: 'T-6'}
	},
	ft: {
		ft_l3: {version: 'L-3'},
		ft_l4: {version: 'L-4'},
		ft_l5: {version: 'L-5'},
		ft_p4: {version: 'P-4'}
	},
	fh: {
		fh_l2: {version: 'L-2'},
		fh_l3: {version: 'L-3'},
		fh_l4: {version: 'L-4'},
		fh_l5: {version: 'L-5'},
		fh_l9: {version: 'L-9'},
		fh_l9b: {version: 'L-9', notes: 'Bootleg'},
		fh_905h: {version: 'L-905H'},
		fh_906h: {version: 'L-906H', notes: 'Coin Play'}
	},
	goldeneye: {
		gldneye: {}
	},
	ij: {
		ij_h1: {version: 'HK-1', notes: 'Family ROM'},
		ij_l3: {version: 'L-3'},
		ij_l4: {version: 'L-4'},
		ij_l5: {version: 'L-5'},
		ij_l6: {version: 'L-6'},
		ij_l7: {version: 'L-7'},
		ij_lg7: {version: 'L-7', language: 'de'},
		ij_p2: {version: 'P-2'}
	},
	i500: {
		i500_10r: {version: '1.0'},
		i500_11b: {version: '1.1'},
		i500_11r: {version: '1.1', language: 'fr-BE'}
	},
	jb: {
		jb_10b: {version: '1.0'},
		jb_10r: {version: '1.0', language: 'fr-BE'}
	},
	jm: {
		jm_05r: {version: '0.5'},
		jm_12r: {version: '1.2'},
		jm_12b: {version: '1.2', language: 'fr-BE'}
	},
	jd: {
		jd_l1: {version: 'L-1'},
		jd_l4: {version: 'L-4'},
		jd_l5: {version: 'L-5'},
		jd_l6: {version: 'L-6'},
		jd_l7: {version: 'L-7'}
	},
	jp: {
		jupk_501: {version: '5.01'},
		jupk_513: {version: '5.13'},
		jupk_g51: {version: '5.01', language: 'de'}
	},
	mm: {
		mm_05: {version: '0.50'},
		mm_10: {version: '1.00'},
		mm_10u: {version: '1.00', notes: 'Ultrapin'},
		mm_109: {version: '1.09'},
		mm_109b: {version: '1.09B'},
		mm_109c: {version: '1.09C', notes: 'Profanity ROM'}
	},
	mb: {
		mb_10: {version: '1.0'},
		mb_106: {version: '1.06'},
		mb_106b: {version: '1.06B'}
	},
	nf: {
		nf_10: {version: '1.0'},
		nf_11x: {version: '1.1X'},
		nf_20: {version: '2.0'},
		nf_22: {version: '2.2'},
		nf_23: {version: '2.3'},
		nf_23f: {version: '2.3F'},
		nf_23x: {version: '2.3X'}
	},
	'playboy-bally': {
		playboy: {},
		playboyb: {notes: '7-digit custom'},
		playboyc: {version: '3', notes: '7-digit custom, free play'},
		playboyd: {version: '3', notes: '7-digit custom, free play'}
	},
	'playboy-stern': {
		play203: {version: '2.03'},
		play203f: {version: '2.03', language: 'fr'},
		play203g: {version: '2.03', language: 'de'},
		play203i: {version: '2.03', language: 'it'},
		play203l: {version: '2.03', language: 'es'},
		play300: {version: '3.00'},
		play302: {version: '3.02'},
		play302f: {version: '3.02', language: 'fr'},
		play302g: {version: '3.02', language: 'de'},
		play302i: {version: '3.02', language: 'it'},
		play302l: {version: '3.02', language: 'es'},
		play303: {version: '3.03'},
		play303f: {version: '3.03', language: 'fr'},
		play303g: {version: '3.03', language: 'de'},
		play303i: {version: '3.03', language: 'it'},
		play303l: {version: '3.03', language: 'es'},
		play401: {version: '4.01'},
		play401f: {version: '4.01', language: 'fr'},
		play401g: {version: '4.01', language: 'de'},
		play401i: {version: '4.01', language: 'it'},
		play401l: {version: '4.01', language: 'es'},
		playboys: {version: '5.00'},
		playboyf: {version: '5.00', language: 'fr'},
		playboyg: {version: '5.00', language: 'de'},
		playboyi: {version: '5.00', language: 'it'},
		playboyl: {version: '5.00', language: 'es'}
	},
	rs: {
		rs_l6: {version: 'L-6'},
		rs_la4: {version: 'L-4'},
		rs_la5: {version: 'L-5'},
		rs_lx2: {version: 'L-2X'},
		rs_lx3: {version: 'L-3X'},
		rs_lx4: {version: 'L-4X'},
		rs_lx5: {version: 'L-5X'}
	},
	sm: {
		sman_260: {version: '2.60'}
	},
	smb: {
		smb: {},
		smb1: {version: '0.1'},
		smb2: {version: '0.2'},
		smb3: {version: '0.3'}
	},
	ss: {
		ss_03: {version: '0.3'},
		ss_12: {version: '1.2'},
		ss_14: {version: '1.4'},
		ss_15: {version: '1.5'},
		ss_01b: {version: 'D.01R', notes: 'Sound Revision 0.25, Coin Play'},
		ss_01: {version: 'D.01R', notes: 'Sound Revision 0.25'}
	},
	sp: {
		sprk_090: {version: '0.90'},
		sprk_096: {version: '0.96'},
		sprk_103: {version: '1.03'}
	},
	spp: {
		simp204f: {version: '2.04', language: 'fr'},
		simp204i: {version: '2.04', language: 'it'},
		simp204l: {version: '2.04', language: 'es'},
		simp204: {version: '2.04'},
		simp300f: {version: '3.00', language: 'fr'},
		simp300i: {version: '3.00', language: 'it'},
		simp300l: {version: '3.00', language: 'es'},
		simp300: {version: '3.00'},
		simp400f: {version: '4.00', language: 'fr'},
		simp400g: {version: '4.00', language: 'de'},
		simp400i: {version: '4.00', language: 'it'},
		simp400l: {version: '4.00', language: 'es'},
		simp400: {version: '4.00'},
		simpprtf: {version: '5.00', language: 'fr'},
		simpprtg: {version: '5.00', language: 'de'},
		simpprti: {version: '5.00', language: 'it'},
		simpprtl: {version: '5.00', language: 'es'},
		simpprty: {version: '5.00'}
	},
	sttng: {
		sttng_l1: {version: 'L-1'},
		sttng_l2: {version: 'L-2'},
		sttng_l3: {version: 'L-3'},
		sttng_l7: {version: 'L-7'},
		sttng_g7: {version: 'L-7', language: 'de'},
		sttng_s7: {version: 'L-7', notes: 'SP1'},
		sttng_p4: {version: 'P-4'},
		sttng_p5: {version: 'P-5'},
		sttng_p8: {version: 'P-8'},
		sttng_x7: {version: 'L-7', notes: 'Special'}
	},
	sw: {
		stwr_102: {version: '1.02'},
		stwr_103: {version: '1.03'},
		stwr_a14: {version: '1.04'},
		stwr_e12: {version: '1.02', language: 'en-UK'},
		stwr_g11: {version: '1.01', language: 'de'}
	},
	tftc: {
		tftc_104: {version: '1.04'},
		tftc_200: {version: '2.00'},
		tftc_302: {version: '3.02'},
		tftc_303: {version: '3.03'}
	},
	totan: {
		totan_04: {version: '0.4'},
		totan_12: {version: '1.2'},
		totan_13: {version: '1.3'},
		totan_14: {version: '1.4'}
	},
	t2: {
		t2_f19: {version: '0.19', notes: 'FreeWPC'},
		t2_f20: {version: '0.20', notes: 'FreeWPC'},
		t2_f32: {version: '0.32', notes: 'FreeWPC'},
		t2_l2: {version: 'L-2'},
		t2_l3: {version: 'L-3'},
		t2_l4: {version: 'L-4'},
		t2_l6: {version: 'L-6'},
		t2_l8: {version: 'L-8'},
		t2_p2f: {version: 'P-2F', notes: 'Profanity ROM'},
		t2_l81: {version: 'L-81', notes: 'Attract sound fix'},
		t2_l82: {version: 'L-82', notes: 'Hacked attract routines'}
	},
	taf: {
		taf_h4: {version: 'H-4'},
		taf_l1: {version: 'L-1'},
		taf_l2: {version: 'L-2'},
		taf_l3: {version: 'L-3'},
		taf_l4: {version: 'L-4'},
		taf_l5: {version: 'L-5'},
		taf_l6: {version: 'L-6'},
		taf_l7: {version: 'L-7'},
		taf_p2: {version: 'P-2'},
		tafg_h3: {version: 'H-3', notes: 'Gold Edition'},
		tafg_la2: {version: 'L-2', notes: 'Gold Edition'},
		tafg_la3: {version: 'L-3', notes: 'Gold Edition'},
		tafg_lx3: {version: 'L-3X', notes: 'Gold Edition'}
	},
	tom: {
		tom_06: {version: '0.6A'},
		tom_10f: {version: '1.0', language: 'fr'},
		tom_12: {version: '1.2X'},
		tom_13: {version: '1.3X'},
		tom_13f: {version: '1.3', language: 'fr'},
		tom_14hb: {version: '1.4HB', notes: 'Coin Play'},
		tom_14h: {version: '1.4H'}
	},
	tmbop: {
		bop_l2: {version: 'L-2'},
		bop_l3: {version: 'L-3'},
		bop_l4: {version: 'L-4'},
		bop_l5: {version: 'L-5'},
		bop_l6: {version: 'L-6'},
		bop_l7: {version: 'L-7'},
		bop_l8: {version: 'L-8'}
	},
	fs: {
		fs_lx2: {version: 'L-2'},
		fs_lx4: {version: 'L-4'},
		fs_lx5: {version: 'L-5'},
		fs_sp2: {version: 'L-5', notes: 'SP-2'}
	},
	hs2: {
		gw_l1: {version: 'L-1'},
		gw_l2: {version: 'L-2'},
		gw_l3: {version: 'L-3'},
		gw_l5: {version: 'L-5'},
		gw_p7: {version: 'P-7'},
		gw_pb: {version: 'P-B'},
		gw_pc: {version: 'P-C'}
	},
	lotr: {
		lotr4: {version: '4.01'},
		lotr_fr4: {version: '4.01', language: 'fr'},
		lotr_it4: {version: '4.01', language: 'de'},
		lotr_gr4: {version: '4.01', language: 'it'},
		lotr_sp4: {version: '4.01', language: 'es'},
		lotr41: {version: '4.10'},
		lotr_f41: {version: '4.10', language: 'fr'},
		lotr_g41: {version: '4.10', language: 'de'},
		lotr_i41: {version: '4.10', language: 'it'},
		lotr5: {version: '5.00'},
		lotr_fr5: {version: '5.00', language: 'fr'},
		lotr_gr5: {version: '5.00', language: 'de'},
		lotr_it5: {version: '5.00', language: 'it'},
		lotr_sp5: {version: '5.00', language: 'es'},
		lotr51: {version: '5.01'},
		lotr_f51: {version: '5.01', language: 'fr'},
		lotr_g51: {version: '5.01', language: 'de'},
		lotr_i51: {version: '5.01', language: 'it'},
		lotr_s51: {version: '5.01', language: 'es'},
		lotr6: {version: '6.00'},
		lotr_fr6: {version: '6.00', language: 'fr'},
		lotr_gr6: {version: '6.00', language: 'de'},
		lotr_it6: {version: '6.00', language: 'it'},
		lotr_sp6: {version: '6.00', language: 'es'},
		lotr7: {version: '7.00'},
		lotr_fr7: {version: '7.00', language: 'fr'},
		lotr_gr7: {version: '7.00', language: 'de'},
		lotr_it7: {version: '7.00', language: 'it'},
		lotr_sp7: {version: '7.00', language: 'es'},
		lotr_8: {version: '8.00'},
		lotr_fr8: {version: '8.00', language: 'fr'},
		lotr_gr8: {version: '8.00', language: 'de'},
		lotr_it8: {version: '8.00', language: 'it'},
		lotr_sp8: {version: '8.00', language: 'es'},
		lotr9: {version: '9.00'},
		lotr_fr9: {version: '9.00', language: 'fr'},
		lotr_gr9: {version: '9.00', language: 'de'},
		lotr_it9: {version: '9.00', language: 'it'},
		lotr_sp9: {version: '9.00', language: 'es'},
		lotr: {version: '10.00'},
		lotr_fr: {version: '10.00', language: 'fr'},
		lotr_gr: {version: '10.00', language: 'de'},
		lotr_it: {version: '10.00', language: 'it'},
		lotr_sp: {version: '10.00', language: 'es'}
	},
	ts: {
		ts_la2: {version: 'L-2'},
		ts_la4: {version: 'L-4'},
		ts_la6: {version: 'L-6'},
		ts_lf6: {version: 'L-6', language: 'fr'},
		ts_lh6: {version: 'LH-6'},
		ts_lm6: {version: 'LM-6', notes: 'Mild'},
		ts_lx4: {version: 'L-4X'},
		ts_lx5: {version: 'L-5X'},
		ts_pa1: {version: 'P-1'}
	},
	'tri-zone': {
		trizn_l1: {version: 'L-1'},
		trizn_t1: {version: 'T-1'}
	},
	tz: {
		tz_92: {version: '9.2'},
		tz_94ch: {version: '9.4CH'},
		tz_94h: {version: '9.4H'},
		tz_h7: {version: 'H-7'},
		tz_h8: {version: 'H-8'},
		tz_ifpa: {version: 'IFPA', notes: 'IFPA Rules'},
		tz_l1: {version: 'L-1'},
		tz_l2: {version: 'L-2'},
		tz_l3: {version: 'L-3'},
		tz_l4: {version: 'L-4'},
		tz_pa1: {version: 'P-1'},
		tz_p3: {version: 'P-3'},
		tz_p4: {version: 'P-4'},
		tz_f10: {version: '0.10', notes: 'FreeWPC'},
		tz_f19: {version: '0.19', notes: 'FreeWPC'},
		tz_f50: {version: '0.50', notes: 'FreeWPC'},
		tz_f86: {version: '0.86', notes: 'FreeWPC'},
		tz_f97: {version: '0.97', notes: 'FreeWPC'},
		tz_f100: {version: '1.00', notes: 'FreeWPC'}
	},
	whirlwind: {
		whirl_l2: {version: 'L-2'},
		whirl_l3: {version: 'L-3'},
		whirl_g3: {version: 'LG-3'}
	},
	whitewater: {
		ww_l2: {version: 'L-2'},
		ww_l3: {version: 'L-3'},
		ww_l4: {version: 'L-4'},
		ww_l5: {version: 'L-5'},
		ww_lh5: {version: 'L-5H'},
		ww_lh6c: {version: 'L-6H', notes: 'Coin Play'},
		ww_lh6: {version: 'L-6H'},
		ww_p1: {version: 'P-1'},
		ww_p2: {version: 'P-2'},
		ww_p8: {version: 'P-8'}
	},
	wcs: {
		wcs_l2: {version: 'LX-2'},
		wcs_la2: {version: 'LA-2'},
		wcs_p2: {version: 'P-2'},
		wcs_p3: {version: 'P-3'},
		wcs_f10: {version: '0.10', notes: 'FreeWPC'},
		wcs_f50: {version: '0.50', notes: 'FreeWPC'},
		wcs_f62: {version: '0.62', notes: 'FreeWPC'}
	},
	xenon: {
		xenon: {},
		xenona: {notes: 'Free Play'},
		xenonf: {language: 'fr'},
		xenonfa: {notes: 'Free Play', language: 'fr'}
	}
};
