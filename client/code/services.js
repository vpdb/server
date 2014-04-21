'use strict';

/* Services */
var services = angular.module('vpdb.services', []);

services.factory('display', function() {
	return {
		media: function(type) {
			switch (type) {
				case 'backglass':
					return 'Backglass';
				case 'flyer':
					return 'Flyer';
				case 'instructioncard':
					return 'Instruction Card';
				default:
					return 'Unknown';
			}
		}
	}
});
