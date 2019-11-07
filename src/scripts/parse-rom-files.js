const { readFileSync, writeFileSync } = require('fs');
const fg = require('fast-glob');

const PROD_EXPORT = '../../roms-production.json';
const PROD_SIMPLE = '../../roms-production-simplified.json';

(async () => {

	const db = JSON.parse(readFileSync(PROD_SIMPLE).toString());
	const mame = await parseRoms();
	const dbByCrc = indexDbByCrc(db);
	const mameByCrc = indexMameByCrc(mame);
	const mameByFilename = indexMameByFilename(mame);

	let matchedCount = 0;
	let notInDbCount = 0;
	let notInMameCount = 0;
	let notInMame = [];
	const notInDb = [];
	const matched = {};

	for (const crc of Object.keys(dbByCrc)) {
		const rows = dbByCrc[crc];
		if (mameByCrc[crc]) {
			matchedCount += collect(rows, mameByCrc[crc], matched);

		} else {
			let hasMatched = false;
			for (const row of rows) {
				if (mameByFilename[row.filename]) {
					hasMatched = true;
					matchedCount += collect(rows, mameByFilename[row.filename], matched);
				}
			}
			if (!hasMatched) {
				notInMameCount++;
				notInMame.push(dbByCrc[crc][0]);
			}
		}
	}

	for (const mameCrc of Object.keys(mameByCrc)) {
		if (!dbByCrc[mameCrc]) {
			notInDbCount++;
			notInDb.push(...mameByCrc[mameCrc].map(m => m.filename));
		}
	}

	writeFileSync('../../rom-types.json', JSON.stringify(matched, null, '  '));

	notInMame = notInMame
		.filter(e => !e.filename.toLowerCase().endsWith('.txt'))
		.filter(e => !e.filename.toLowerCase().endsWith('.doc'))
		.filter(e => !e.filename.toLowerCase().endsWith('.pdf'));

	console.log('========================================================================');
	console.log('Matched: %s', matchedCount);
	console.log('------------------------------------------------------------------------');
	console.log('Not in DB (%s):\n%s', notInDbCount, notInDb);
	console.log('------------------------------------------------------------------------');
	console.log('Not in Mame (%s):\n   %s', notInMame.length, notInMame.map(e => `${e.id}: ${e.filename}`).join('\n   '));

})();

function collect(rows, mames, matched) {
	let n = 0;
	for (const row of rows) {
		if (!matched[row.id]) {
			matched[row.id] = {};
		}
		for (const mame of mames) {
			if (!matched[row.id][row.filename.toLowerCase()]) {
				n++;
			}
			matched[row.id][row.filename.toLowerCase()] = {
				filename: row.filename,
				type: mame.type,
				romType: mame.romType,
			};
		}
	}
	return n;
}

function indexMameByCrc(mameRoms) {
	const mameByCrc = {};
	for (const rom of mameRoms) {
		if (!mameByCrc[rom.crc]) {
			mameByCrc[rom.crc] = [];
		}
		mameByCrc[rom.crc].push(rom);
	}
	return mameByCrc;
}

function indexMameByFilename(mameRoms) {
	const mameByFilename = {};
	for (const rom of mameRoms) {
		if (!mameByFilename[rom.filename]) {
			mameByFilename[rom.filename] = [];
		}
		mameByFilename[rom.filename].push(rom);
	}
	return mameByFilename;
}

function indexDbByCrc(prodRoms) {
	const indexByCrc = {};
	for (const rom of prodRoms) {
		for (const file of rom.rom_files) {
			if (!indexByCrc[file.crc]) {
				indexByCrc[file.crc] = [];
			}
			indexByCrc[file.crc].push({ id: rom.id, filename: file.filename });
		}
	}
	return indexByCrc;
}

async function parseRoms() {

	const entries = await fg(['../../../pinmame/src/**/*.c'], { dot: true });
	//const entries = await fg(['../../../pinmame/src/**/mm.c'], { dot: true });

	const reFilenameCrc = /"(?<filename>[^"]+)"\s*,\s*CRC\((?<crc>[^)]+)\)/gi;
	const reId1Id2FilenameId3Crc = /(?<id>[^,]+),[^,]+,\s*"(?<filename>[^"]+)"\s*,[^,]+,\s*CRC\s*\((?<crc>[^)]+)/gi;
	const reFilenameId1Id2Crc = /"(?<filename>[^"]+)"\s*,[^,]*,[^,]*,\s*CRC\((?<crc>[^)]+)/gi;
	const reIdFilenameCrc = /\s*\((?<id>[^,]+),\s*"(?<filename>[^"]+)"\s*,\s*CRC\s*\((?<crc>[^)]+)/gi;

	const nLiners = [
		{ type: 'main', romType: 'wpc', outer: outerRe(/WPC_ROMSTART/gi), inner: reId1Id2FilenameId3Crc },
		{ type: 'main', romType: 'capcom', outer: outerRe(/CC_ROMSTART_\w+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'gts', outer: outerRe(/GTS80_\d+_ROMSTART/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'gts', outer: outerRe(/GTS\d+ROMSTART/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'jp', outer: outerRe(/JP_ROMSTART\d+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'de', outer: outerRe(/DE_ROMSTARTx?\d+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'se', outer: outerRe(/SE128_ROMSTART/gi), inner: reIdFilenameCrc },
		{ type: 'main', romType: 'sam', outer: outerRe(/SAM\d+_ROM\d+MB/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'gts', outer: outerRe(/GTS\w+_ROMSTART/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 's4', outer: outerRe(/S4_ROMSTART\d*x?/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 's6', outer: outerRe(/S6_ROMSTART[0-9a-z]*/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 's7', outer: outerRe(/S7_ROMSTART\d+x?/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 's9', outer: outerRe(/S9_ROMSTART\w+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 's11', outer: outerRe(/S11_ROMSTART\d+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'st', outer: outerRe(/ST200_ROMSTART\d+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'by', outer: outerRe(/BY[\dvp]+_ROMSTART\d*x?\d+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'by', outer: outerRe(/BY\d+_ROMSTART_[a-z0-9]+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'by', outer: outerRe(/BY8035_ROMSTART/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'zac', outer: outerRe(/ZAC_ROMSTART\d+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'playmatic', outer: outerRe(/PLAYMATIC_ROMSTART\w+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'atari', outer: outerRe(/ATARI_\d+_ROMSTART/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'atari', outer: outerRe(/ATARI_\dx\d_ROMSTART/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'spinball', outer: outerRe(/SPINB_ROMSTART\d*/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'mrgame', outer: outerRe(/MRGAME_ROMSTART/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'taito', outer: outerRe(/TAITO_ROMSTART\w+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'sleic', outer: outerRe(/SLEIC_ROMSTART\d+/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'inder', outer: outerRe(/INDER_ROMSTART\w*/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'gp', outer: outerRe(/GP_ROMSTART\w*/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'peyper', outer: outerRe(/PEYPER_ROMSTART\d*/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'ltd', outer: outerRe(/LTD_\d+_ROMSTART/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'alvin', outer: outerRe(/ALVGROMSTART/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'hnk', outer: outerRe(/HNK_ROMSTART/gi), inner: reFilenameCrc },
		{ type: 'main', romType: 'ps', outer: outerRe(/PS_ROMSTART\d+K/gi), inner: reFilenameCrc },
		{ type: 'main', outer: outerRe(/ROM_LOAD/i), inner: reFilenameId1Id2Crc },
		{ type: 'sound', outer: outerRe(/S\d+[CX]*S_SOUNDROM\d*/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/BY[\dsd]+_SOUNDROM\d*x*\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/BY\w+_SOUNDROM\w*/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/DCS_SOUNDROM\d+[xm]*/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/GTS80SS22_ROMSTART/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/GTS80BSSOUND\w+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/GTS80S1K_ROMSTART+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/ZAC_SOUNDROM_de2g/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/MRGAME_SOUNDROM\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/JP_SNDROM\w*/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/S67S_SPEECHROMS\d+x?/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/S67S_SOUNDROMS\d+x?/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/VSU100_SOUNDROM_U\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/GTS\d+SOUND\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/DE\d+S[AC]?_SOUNDROM\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/WPCS?_SOUNDROM\w*/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/SPINB_SNDROM\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/INDER_SNDROM\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/ZAC_SOUNDROM_[a-z0-9]+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/PLAYMATIC_SOUNDROM\w*/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/MRGAME_SOUNDROM\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/TAITO_SOUNDROMS\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/CAPCOMS_SOUNDROM\w*/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/ALVGS_SOUNDROM\w*/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/HNK_SOUNDROMS/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/GP_SOUNDROM\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/VSU\d+_SOUNDROM_\w+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/TECHNO_SOUNDROM\d+/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/ATARI_SNDSTART/gi), inner: reFilenameCrc },
		{ type: 'sound', outer: outerRe(/S11JS_SOUNDROM/gi), inner: reFilenameCrc },
		{ type: 'dmd', outer: outerRe(/DE_DMD\d+ROM\d+x?/i), inner: reFilenameCrc },
		{ type: 'dmd', outer: outerRe(/ALVGDMD_SPLIT_ROM/i), inner: reFilenameCrc },
		{ type: 'dmd', outer: outerRe(/SPINB_DMDROM\d+/i), inner: reFilenameCrc },
		{ type: 'dmd', outer: outerRe(/MRGAME_VIDEOROM\d+/i), inner: reFilenameCrc },
		{ type: 'dmd', outer: outerRe(/GTS\d+_DMD\d+_ROMSTART\d*/i), inner: reFilenameCrc },
		{ type: 'dmd', outer: outerRe(/ALVGDMD_ROM\w*/i), inner: reFilenameCrc },
		{ type: 'dmd', outer: outerRe(/VIDEO_ROMSTART/i), inner: reFilenameCrc },
	];

	const roms = [];
	for (const entry of entries) {
		const src = readFileSync(entry).toString();
		for (const matcher of nLiners) {
			let outer;
			do {
				outer = matcher.outer.exec(src);
				if (outer) {
					let inner;
					do {
						inner = matchInner(matcher, matcher.inner.exec(outer[0]), roms);
					} while (inner);
				}
			} while (outer);
		}
	}
	return roms;
}

function outerRe(id) {
	const suffix = /\s*\([\s\S]*?(\)|0x[0-9a-f]{8})\s*\)/gi;
	return concatRegex(id, suffix);
}

function concatRegex(regex1, regex2) {
	const flags = (regex1.flags + regex2.flags).split("").sort().join("").replace(/(.)(?=.*\1)/g, "");
	return new RegExp(regex1.source + regex2.source, flags);
}

function matchInner(matcher, match, roms) {
	if (match) {
		const g = match.groups;
		roms.push({
			type: matcher.type,
			romType: matcher.romType,
			//gameId: g.id ? g.id.trim() : undefined,
			filename: g.filename.trim(),
			crc: parseInt(g.crc.trim(), 16),
		});
		return true;
	}
	return false;
}

function simplifyDbExport() {
	const prodRoms = JSON.parse(readFileSync(PROD_EXPORT).toString());
	const prodRomsSimple = [];
	for (const rom of prodRoms) {
		prodRomsSimple.push({
			id: rom.id,
			rom_files: rom.rom_files.map(f => ({
				filename: f.filename,
				crc: parseInt(f.crc[Object.keys(f.crc)[0]], 10),
			}))
		});
	}
	writeFileSync(PROD_SIMPLE, JSON.stringify(prodRomsSimple, null, '  '));
}
