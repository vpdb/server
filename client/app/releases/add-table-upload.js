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

"use strict"; /* global _ */

/**
 * Uploads files to the server and stores the result.
 *
 * Pass two parameters for result storage:
 *
 *   - `meta`: Data that is not sent to the server, but needed for displaying
 *     the file, such as icon class, upload progress, flavors, etc.
 *   - `result`: Data sent to the server as-is, i.e. server's release FileSchema.
 *
 * Both parameters must be already initialized arrays.
 */
angular.module('vpdb.releases.add', [])
	.directive('tableUpload', function($upload, $parse, $compile, ApiHelper, ModalService, DisplayService, ConfigService) {

	var allowedExtensions = ['vpt', 'vpx', 'vbs', 'txt', 'md'];

	return {
		restrict: 'A',
		terminal: true,
		priority: 1000,
		link: function(scope, element, attrs) {

			// parse parameters
			var params = $parse(attrs.tableUpload)(scope);

			// add file drop directive
			element.attr('ng-file-drop', 'onFilesUpload($files)');
			element.removeAttr("table-upload"); // remove the attribute to avoid indefinite loop
			$compile(element)(scope);

			scope.onFilesUpload = function($files) {

				var meta = params.meta;
				var result = params.result;

				// 1. validate file types
				for (var i = 0; i < $files.length; i++) {
					var file = $files[i];
					var ext = file.name.substr(file.name.lastIndexOf('.') + 1, file.name.length).toLowerCase();

					if (!_.contains(allowedExtensions, ext)) {
						// TODO "more info to come"
						return ModalService.info({
							icon: 'upload-circle',
							title: 'Table Upload',
							subtitle: 'Wrong file type!',
							message: 'Please upload a valid file type (more info to come).'
						});
					}
				}

				// 2. upload files
				_.each($files, function(upload) {
					var fileReader = new FileReader();
					fileReader.readAsArrayBuffer(upload);
					fileReader.onload = function(event) {
						var ext = upload.name.substr(upload.name.lastIndexOf('.') + 1, upload.name.length);
						var type = upload.type;
						var isTable = false;
						if (!type) {
							switch (ext) {
								case 'vpt':
									type = 'application/x-visual-pinball-table';
									isTable = true;
									break;
								case 'vpx':
									type = 'application/x-visual-pinball-table-x';
									isTable = true;
									break;
								case 'vbs':
									type = 'application/vbscript';
									break;
							}
						}
						var file = {
							name: upload.name,
							bytes: upload.size,
							icon: DisplayService.fileIcon(type),
							uploaded: false,
							uploading: true,
							progress: 0,
							flavor: {},
							builds: []
						};
						meta.push(file);
						$upload.http({
							url: ConfigService.storageUri('/files'),
							method: 'POST',
							params: { type: 'release' },
							headers: {
								'Content-Type': type,
								'Content-Disposition': 'attachment; filename="' + upload.name + '"'
							},
							data: event.target.result
						}).then(function(response) {
							file.uploading = false;
							file.storage = response.data;
							if (!isTable) {
								result.push({ _file: response.data.id });
							} else {
								result.push({
									_file: response.data.id,
									flavor: file.flavor,
									_compatibility: file.builds,
									_media: {
										playfield_image: null,
										playfield_video: null
									}
								});
							}

						}, ApiHelper.handleErrorsInDialog(scope, 'Error uploading file.', function() {
							meta.splice(meta.indexOf(file), 1);
						}), function (evt) {
							file.progress = parseInt(100.0 * evt.loaded / evt.total);
						});
					};
				});
			};
		}
	};
});