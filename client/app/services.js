"use strict";

/* Services */
var services = angular.module('vpdb.services', []);

services.factory('DisplayService', function() {
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
		},

		fileIcon: function(mimeType) {
			switch (mimeType) {
				case 'application/x-visual-pinball-table':   return 'icon-ext-vpt';
				case 'application/x-visual-pinball-table-x': return 'icon-ext-vpx';
				case 'application/vbscript':                 return 'icon-ext-code';
				case 'audio/mpeg':                           return 'icon-ext-audio';
				case 'image/jpeg':
				case 'image/png':                            return 'icon-ext-image';
				case 'text/plain':                           return 'icon-ext-txt';
				case 'video/mp4':
				case 'video/x-flv':                          return 'icon-ext-video';
				default:                                     return 'icon-ext';
			}
		}
	};
});

services.factory('MimeTypeService', function() {
	return {
		fromFile: function(file) {
			// check if the browser already set it
			if (file.type) {
				return file.type;
			}
			var ext = file.name.substr(file.name.lastIndexOf('.'));
			switch (ext) {
				case '.f4v':
					return 'video/x-flv';
				default:
					return null;
			}
		}
	};
});


services.factory('ProfileService', function($rootScope, ProfileResource) {
	return {
		init: function() {

			// this is primarily used by AuthService in order to avoid cyclic deps.
			$rootScope.$on('updateUser', function() {
				ProfileResource.get(function(user) {
					$rootScope.$broadcast('userUpdated', user);
				}, function(err) {
					console.log('Error retrieving user profile: %s', err);
				});
			});
		}
	};
});
