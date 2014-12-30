"use strict"; /* global ga, _ */

/**
 * Home page of VPDB, i.e. the root index page.
 */
angular.module('vpdb.modal', [])

	.factory('ModalService', function($modal) {

		return {

			/**
			 * Displays an error dialog.
			 * @param {object} data Scope variables. Properties:
			 *     <li> `icon`: title bar icon, default "warning"
			 *     <li> `title`: title in dialog bar, default ""
			 *     <li> `subtitle`: body title
			 *     <li> `message`: body message
			 *     <li> `close`: text of the close button
			 * @param {boolean} [flash] If true, the dialog isn't displayed instantly but on the next page.
			 */
			error: function(data, flash) {
				return this._modal(data, { icon: 'warning', title: 'Ooops!', close: 'Close' }, flash);
			},


			/**
			 * Displays an error dialog.
			 * @param {object} data Scope variables. Properties:
			 *     <li> `icon`: title bar icon, default "info"
			 *     <li> `title`: title in dialog bar
			 *     <li> `subtitle`: body title
			 *     <li> `message`: body message
			 *     <li> `close`: text of the close button, default "close".
			 * @param {boolean} [flash] If true, the dialog isn't displayed instantly but on the next page.
			 */
			info: function(data, flash) {
				return this._modal(data, { icon: 'info', close: 'Close' }, flash);
			},


			/**
			 * Displays a question dialog.
			 * @param {object} data Scope variables. Properties:
			 *     <li> `icon`: title bar icon, default "question-circle"
			 *     <li> `title`: title in dialog bar
			 *     <li> `message`: message before the question
			 *     <li> `question`: question (centered)
			 *     <li> `yes`: text of the yes button, default "Yes"
			 *     <li> `no`: text of the no button, default "No"
			 */
			question: function(data) {
				var defaults = {
					icon: 'question-circle',
					yes: 'Yes',
					no: 'No'
				};
				data = _.defaults(data, defaults);
				return $modal.open({
					templateUrl: '/modal/modal-question.html',
					controller: 'ModalCtrl',
					resolve: { data: function() { return data; } }
				});
			},


			/**
			 * Displays a simple dialog.
			 * @see #error
			 * @see #info
			 * @param {object} data Scope variables under `data`.
			 * @param {object} defaults Default scope variables
			 * @param {boolean} flash If true, the dialog isn't displayed instantly but on the next page.
			 * @private
			 */
			_modal: function(data, defaults, flash) {

				data = _.defaults(data, defaults);
				if (flash) {
					this._flashMessage = data;
				} else {
					return $modal.open({
						templateUrl: '/modal/modal-error-info.html',
						controller: 'ModalCtrl',
						resolve: { data: function() { return data; } }
					});
				}
			},

			_flashMessage: null
		};
	})

	.factory('ModalFlashService', function($modal, ModalService) {

		return {

			/**
			 * Displays an error dialog on the next page.
			 * @param {object} data Scope variables. Properties:
			 *     - `icon`: title bar icon, default 'warning'
			 *     - `title`: title in dialog bar, default ""
			 *     - `subtitle`: body title
			 *     - `message`: body message
			 *     - `close`: text of the close button
			 */
			error: function(data) {
				return ModalService.error(data, true);
			},

			/**
			 * Displays an info dialog on the next page.
			 * @param {object} data Scope variables. Properties:
			 *     - `icon`: title bar icon, default 'info'
			 *     - `title`: title in dialog bar
			 *     - `subtitle`: body title
			 *     - `message`: body message
			 *     - `close`: text of the close button, default "close".
			 */
			info: function(data) {
				return ModalService.info(data, true);
			},

			/**
			 * Displays the flash message, if there's any.
			 */
			process: function() {

				if (ModalService._flashMessage) {
					var data = _.clone(ModalService._flashMessage);
					ModalService._flashMessage = null;
					$modal.open({
						templateUrl: '/modal/modal-error-info.html',
						controller: 'ModalCtrl',
						resolve: { data: function() { return data; } }
					});
				}
			}
		};
	})

	.controller('ModalCtrl', function($scope, data) {
		$scope.data = data;
	});