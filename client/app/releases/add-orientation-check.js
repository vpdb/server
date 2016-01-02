/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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

"use strict"; /* global angular, _ */

/**
 * Confirms orientation change when media is already uploaded.
 *
 * Parameters:
 *   - `flavor`: Flavor object that is about to change
 *   - `flavorVal`: Flavor value
 *   - `file`: File to which the flavor is linked to
 *   - `files`: All files, so we can remove it if orientation change successful
 *   - `metaFiles`: Meta files, same reason as above
 *   - `metaLinks`: Meta link array
 */
angular.module('vpdb.releases.add', []).directive('orientationCheck', function($parse, ApiHelper, ModalService, FileResource) {

	return {
		restrict: 'A',
		link: function(scope, element, attrs) {
			var params = $parse(attrs.orientationCheck)(scope);

			/**
			 * Confirms orientation change when media is already uploaded.
			 *
			 * @param {object} event Click event object
			 */
			element.click(function(event) {

				// ignore everything non-orientation related
				if (params.flavor.name !== 'orientation') {
					return;
				}

				var checkbox = element.find('input');
				var model = $parse(checkbox.attr('ng-model'))(scope);

				// only confirm if there's a media file uploaded
				for (var i = 0; i < params.types.length; i++) {

					var type = params.types[i];
					var metaFileId = type + ':' + params.file.storage.id;
					if (params.metaFiles[metaFileId]) {

						event.preventDefault();

						return ModalService.question({
							title: 'Change Orientation',
							message: 'You\'re about to change orientation for a file for which you already have uploaded media. Changing orientation will remove media of the file which you\'re about to change.',
							question: 'Do you want to change the orientation?'

						}).result.then(function() {

							// update flavor
							params.releaseFile.flavor[params.flavor.name] = params.flavorVal.value;

							// remove media files from server
							for (var j = 0; j < params.types.length; j++) {
								var type = params.types[j];
								var metaFileId = type + ':' + params.file.storage.id;

								if (params.metaFiles[metaFileId]) {
									FileResource.delete({ id: params.metaFiles[metaFileId].storage.id });

									// clear local media
									delete params.metaFiles[metaFileId];
									if (params.files) {
										delete params.files[metaFileId];
									}

									// ugly hack so bg-img knows it needs to reset. (null false are received as undefined for some reason)
									params.metaLinks[metaFileId] = '__null';
								}
							}
						});
					}
				}
			});
		}
	};
});