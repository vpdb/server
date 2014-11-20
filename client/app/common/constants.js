"use strict"; /* global common, _ */

common

	.constant('Flavors', {
		orientation: {
			header: 'Orientation',
			name: 'orientation',
			values: {
				ws: { name: 'Desktop', other: 'Landscape', value: 'ws' },
				fs: { name: 'Cabinet', other: 'Portrait', value: 'fs' }
			}
		},
		lightning: {
			header: 'Lightning',
			name: 'lightning',
			values: {
				night: { name: 'Night', other: 'Dark Playfield', value: 'night' },
				day: { name: 'Day', other: 'Illuminated Playfield', value: 'day' }
			}
		}
	});