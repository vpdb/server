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

"use strict"; /* global angular, _ */

/**
 * Uploads files to the server and stores the result.
 *
 * Pass the following parameters:
 *
 *  - `type`:      Upload type posted to the API
 *  - `status`:    A list where the status of the uploaded file is pushed to. If
 *                 you additionally provide `key`, it'll be added as a property
 *                 with the given key.
 *  - `key`:       If set, set status and response as property instead of array
 *                 element
 *  - `onSuccess`: function called when upload successfully finishes
 *  - `onClear`:   function called when a previous upload was deleted
 *  - `onError`:   function called when the upload failed
 *  - `allowedExtensions`: Only allow file extensions of this array if specified.
 *  - 'allowMultipleFiles`: Allow multiple files if true. Default false.
 *
 * All parameters must be already initialized.
 */
angular.module('vpdb.common', []).directive('fileUpload', function($parse, $compile, Upload, ApiHelper,
																   AuthService, ModalService, DisplayService,
																   ConfigService, FileResource) {
	return {
		restrict: 'A',
		scope: true,
		terminal: true,
		priority: 1000,
		link: function(scope, element, attrs) {

			// parse parameters
			var params = $parse(attrs.fileUpload)(scope);
			var fctName = 'onFilesUpload';

			// add file drop directive: https://github.com/danialfarid/ng-file-upload#file-drop
			element.attr('ngf-drop', 'true');
			element.attr('ngf-change', fctName + '($files)');
			if (!params.disableSelect) {
				element.attr('ngf-select', fctName + '($files)');
			}
			element.attr('ngf-multiple', params.allowMultipleFiles === true ? 'true' : 'false');

			// remove the attribute to avoid indefinite loop
			element.removeAttr('file-upload');
			$compile(element)(scope);

			// can be removed at some point..
			if (params.key && params.allowMultipleFiles) {
				console.error('Multiple files allowed AND key set. Probably a bug?')
			}

			scope[fctName] = function($files) {

				if (!$files) {
					return;
				}

				// parse again, in case refs have changed (like, someone pressed the reset button).
				var params = $parse(attrs.fileUpload)(scope);

				// check for multiple files
				var allowMultipleFiles = params.allowMultipleFiles === true;
				if (!allowMultipleFiles && $files.length > 1) {
					return ModalService.info({
						icon: 'upload-circle',
						title: 'File Upload',
						subtitle: 'Multiple files',
						message: 'You cannot upload multiple files. Please drop only a single file.'
					});
				}

				// validate file types
				for (var i = 0; i < $files.length; i++) {
					var file = $files[i];
					var ext = file.name.substr(file.name.lastIndexOf('.') + 1, file.name.length).toLowerCase();
					if (!_.contains(params.allowedExtensions, ext)) {
						return ModalService.info({
							icon: 'upload-circle',
							title: 'File Upload',
							subtitle: 'Wrong file type.',
							message: 'Please upload a valid file type. Allowed file extensions: ' + params.allowedExtensions.join(', ')
						});
					}
				}

				// upload files
				_.each($files, function(file) {

					// delete if exists
					if (params.key && params.status[params.key] && params.status[params.key].storage && params.status[params.key].storage.id) {
						FileResource.delete({ id : params.status[params.key].storage.id });
						if (params.onClear) {
							params.onClear(params.key);
						}
						scope.$emit('imageUnloaded');
					}

					// setup result variables
					var mimeType = getMimeType(file);
					var status = {
						name: file.name,
						bytes: file.size,
						mimeType: mimeType,
						icon: DisplayService.fileIcon(mimeType),
						uploaded: false,
						uploading: true,
						progress: 0,
						text: 'Uploading file...',
						storage: {},
						key: params.key,
						randomId: makeid(32)
					};

					if (params.key) {
						params.status[params.key] = status;
					} else {
						params.status.push(status);
					}

					// run pre-function if defined
					if (params.beforeUpload) {
						params.beforeUpload(status);
					}

					// post data
					Upload.upload({
						url: ConfigService.storageUri('/files'),
						method: 'POST',
						params: { type: params.type, content_type: mimeType },
						data: { file: file }

					}).then(function(response) {

						status.uploading = false;
						status.storage = response.data;

						params.onSuccess(status);

					}, ApiHelper.handleErrorsInDialog(scope, 'Error uploading file.', function() {
						if (params.onError) {
							params.onError(status);
						}
						if (params.key) {
							delete params.status[params.key];
						} else {
							params.status.splice(params.status.indexOf(status), 1);
						}
					}), function (evt) {
						status.progress = parseInt(100.0 * evt.loaded / evt.total);
					});
				});
			}
		}
	};
});

function getMimeType(file) {
	if (file.type) {
		return file.type;
	}
	var ext = file.name.substr(file.name.lastIndexOf('.') + 1, file.name.length).toLowerCase();
	switch (ext) {
		case 'jpg': return 'image/jpeg';
		case 'png': return 'image/png';
		case 'zip': return 'application/zip';
		case 'rar': return 'application/rar';
		case 'vpt': return 'application/x-visual-pinball-table';
		case 'vpx': return 'application/x-visual-pinball-table-x';
		case 'directb2s': return 'application/x-directb2s';
		case 'vbs': return 'application/vbscript';
		case 'mp3': return 'audio/mp3';
		case 'avi': return 'video/avi';
		case 'mp4': return 'video/mp4';
		case 'flv': return 'video/x-flv';
		case 'f4v': return 'video/x-f4v';
		case 'txt': return 'text/plain';
	}
}

function makeid(len) {

	var text = "";
	var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

	for (var i = 0; i < len; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}