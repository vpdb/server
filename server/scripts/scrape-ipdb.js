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

"use strict";

var fs = require('fs');
var async = require('async');
var path = require('path');

var ipdb = require('../modules/ipdb');

var stopAfter = 7000;
var wait = 1200;
var dataFile = path.resolve(__dirname, '../../data/ipdb.json');
var data = fs.existsSync(dataFile) ? require(dataFile) : [];

var n = 0;
var id = data.length > 0 ? data[data.length - 1].ipdb.number + 1 : 1;
var dead = [10, 19, 52, 60, 61, 65, 69, 70, 76, 118, 145, 150, 157, 190, 203, 238, 266, 291, 293, 334, 339, 371, 400,
	440, 465, 485, 505, 550, 559, 561, 574, 578, 705, 898, 951, 986, 1022, 1033, 1055, 1099, 1102, 1170, 1174, 1180,
	1186, 1204, 1205, 1212, 1272, 1326, 1334, 1387, 1420, 1461, 1512, 1547, 1554, 1575, 1598, 1599, 1603, 1611, 1630,
	1671, 1731, 1751, 1818, 1831, 1838, 1842, 1855, 1913, 1952, 1957, 1973, 1982, 1985, 2023, 2024, 2032, 2094, 2167,
	2174, 2176, 2198, 2234, 2249, 2256, 2266, 2314, 2368, 2381, 2382, 2384, 2456, 2473, 2518, 2523, 2575, 2623, 2624,
	2655, 2679, 2690, 2773, 2817, 2830, 2878, 2891, 2896, 2903, 2912, 2913, 2914, 2915, 2916, 2917, 2918, 2919, 2920,
	2921, 2922, 2923, 2924, 2925, 2926, 2927, 2928, 2929, 2930, 2931, 2932, 2933, 2934, 2935, 2936, 2937, 2938, 2939,
	2940, 2941, 2942, 2943, 2944, 2945, 2946, 2947, 2948, 2949, 2950, 2951, 2952, 2953, 2954, 2955, 2956, 2957, 2958,
	2959, 2960, 2961, 2962, 2963, 2964, 2965, 2966, 2967, 2968, 2969, 2970, 2971, 2972, 2973, 2974, 2975, 2976, 2977,
	2978, 2979, 2980, 2981, 2982, 2983, 2984, 2985, 2986, 2987, 2988, 2989, 2990, 2991, 2992, 2993, 2994, 2995, 2996,
	2997, 2998, 2999, 3001, 3009, 3011, 3017, 3022, 3034, 3036, 3039, 3042, 3048, 3056, 3066, 3076, 3080, 3081, 3082,
	3099, 3107, 3110, 3122, 3127, 3130, 3134, 3136, 3154, 3159, 3168, 3176, 3180, 3184, 3196, 3197, 3204, 3214, 3227,
	3231, 3249, 3261, 3264, 3272, 3280, 3286, 3290, 3296, 3303, 3304, 3308, 3309, 3318, 3324, 3326, 3328, 3342, 3345,
	3346, 3353, 3357, 3359, 3374, 3378, 3379, 3397, 3398, 3418, 3428, 3436, 3437, 3444, 3470, 3476, 3478, 3479, 3492,
	3499, 3504, 3514, 3516, 3522, 3526, 3529, 3540, 3554, 3577, 3579, 3580, 3615, 3655, 3664, 3680, 3700, 3739, 3740,
	3741, 3796, 3797, 3819, 3835, 3850, 3913, 3930, 3937, 3991, 4006, 4030, 4035, 4036, 4100, 4135, 4281, 4331, 4349,
	4369, 4448, 4449, 4491, 4494, 4503, 4508, 4514, 4624, 4688, 4722, 4756, 4766, 4796, 4835, 4845, 4925, 4955, 4993,
	5046, 5084, 5102, 5107, 5131, 5144, 5147, 5194, 5201, 5212, 5234, 5241, 5250, 5253, 5273, 5286, 5360, 5415, 5483,
	5520, 5524, 5525, 5565, 5720, 5735, 5863, 6106, 6222, 4652];

async.whilst(function() {
	return n < stopAfter;
}, function(next) {
	if (~dead.indexOf(id)) {
		console.log('Skipping dead ID %d.', id);
		id++;
		return next();
	}
	ipdb.details(id, function(err, game) {
		if (err) {
			if (/^empty page/i.test(err)) {
				console.warn('Empty page, skipping.');
				n++;
				id++;
				return next();
			}
			return next(err);
		}
		data.push(game);
		fs.writeFileSync(dataFile, JSON.stringify(data, null, '\t'));
		n++;
		id++;
		setTimeout(next, wait);
	});
}, function(err) {
	if (err) {
		console.error('ERROR: %s', err);
	} else {
		console.info('Done!');
	}
});
