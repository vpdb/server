"use strict"; /* global angular */

angular.module('vpdb', [])

	.factory('DisplayService', function() {
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
					case 'application/x-visual-pinball-table':   return 'ext-vpt';
					case 'application/x-visual-pinball-table-x': return 'ext-vpx';
					case 'application/vbscript':                 return 'ext-code';
					case 'application/zip':                      return 'ext-rom';
					case 'audio/mpeg':                           return 'ext-audio';
					case 'image/jpeg':
					case 'image/png':                            return 'ext-image';
					case 'text/plain':                           return 'ext-txt';
					case 'video/mp4':
					case 'video/x-flv':                          return 'ext-video';
					default:                                     return 'ext';
				}
			}
		};
	})

	.filter('mediatype', function(DisplayService) {
		return function(type) {
			return DisplayService.media(type);
		};
	})

	.factory('MimeTypeService', function() {
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
	})

	.factory('ProfileService', function($rootScope, ProfileResource) {
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
	})

	.filter('gametype', function() {
		return function(type) {
			if (type) {
				switch (type.toLowerCase()) {
					case 'ss':
						return 'Solid-State Game';
					case 'em':
						return 'Electro-Mechanical Game';
					case 'pm':
						return 'Pure Mechanical';
					case 'og':
						return 'Original Game';
					default:
						return type;
				}
			} else {
				return 'Undefined';
			}
		};
	});
