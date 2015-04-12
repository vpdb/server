"use strict"; /* global angular, _ */

angular.module('vpdb', [])

	.constant('Flavors', {
		orientation: {
			header: 'Orientation',
			name: 'orientation',
			values: {
				ws: { name: 'Desktop', other: 'Landscape', value: 'ws' },
				fs: { name: 'Cabinet', other: 'Portrait', value: 'fs' },
				any: { name: 'Universal', other: 'Any Orientation', value: 'any' }
			}
		},
		lightning: {
			header: 'Lightning',
			name: 'lightning',
			values: {
				night: { name: 'Night', other: 'Dark Playfield', value: 'night' },
				day: { name: 'Day', other: 'Illuminated Playfield', value: 'day' },
				any: { name: 'Universal', other: 'Customizable', value: 'any' }
			}
		}
	});