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
/* global angular, _ */

angular.module('vpdb.editor', [])

	/**
	 * Use like this:
	 *
	 *  rating-avg="game.rating.average",
	 *  rating-votes="game.rating.votes",
	 *  rating-user="gameRating"
	 *  rating-action="rateGame($rating)"
	 */
	.directive('editor', function($timeout) {

		function setSelectionRange(input, selectionStart, selectionEnd) {
			if (input.setSelectionRange) {
				input.focus();
				input.setSelectionRange(selectionStart, selectionEnd);
			}
			else if (input.createTextRange) {
				var range = input.createTextRange();
				range.collapse(true);
				range.moveEnd('character', selectionEnd);
				range.moveStart('character', selectionStart);
				range.select();
			}
		}

		function wrap(element, text, chars) {
			text = text || '';
			var n, b;
			var start = element.prop('selectionStart');
			var end = element.prop('selectionEnd');
			var selection = start === end ? start : -1;

			// check if current selection is already wrapped in chars
			if (start >= chars.length && text.substring(start - chars.length, start) === chars &&
				text.length >= end + chars.length && text.substring(end, end + chars.length) === chars) {
				return {
					text: [text.slice(0, start - chars.length), text.slice(start, end), text.slice(end + chars.length)].join(''),
					start: start - chars.length,
					end: end - chars.length
				}
			}

			// check if current word is already wrapped in chars
			if (start === end && end !== text.length) {
				// start
				b = false;
				for (n = start; n >= 0; n--) {
					if (/^\s$/.test(text.substring(n - 1, n))) {
						start = n;
						b = true;
						break;
					}
				}
				if (!b) {
					start = 0;
				}
				// end
				b = false;
				for (n = end; n < text.length; n++) {
					if (/^\s$/.test(text.substring(n, n + 1))) {
						end = n;
						b = true;
						break;
					}
				}
				if (!b) {
					end = text.length;
				}
			}

			// check again if current selection is already wrapped in chars
			if (text.substring(start, start + chars.length) === chars && text.substring(end - chars.length, end) === chars) {
				return {
					text: [text.slice(0, start), text.slice(start + chars.length, end - chars.length), text.slice(end)].join(''),
					start: (selection < 0 ? start : selection) - chars.length,
					end: (selection < 0 ? end : selection) - chars.length
				}
			}

			return {
				text: [text.slice(0, start), chars, text.slice(start, end), chars, text.slice(end)].join(''),
				start: (selection < 0 ? start : selection) + chars.length,
				end: (selection < 0 ? end : selection) + chars.length
			}
		}

		function bold(textarea, text) {
			return wrap(textarea, text, '**');
		}

		function apply(element, scope, result) {
			scope.text = result.text;
			setTimeout(function() {
				setSelectionRange(element[0], result.start, result.end);
			}, 0);
		}
		return {
			restrict: 'E',
			scope: {
				text: '='
			},
			replace: true,
			templateUrl: '/common/editor.html',
			controller: function($scope, $element) {
				$scope.textBold = function() {
					var textarea = $element.find('textarea');
					apply(textarea, $scope, bold(textarea, $scope.text));
				};
			}
		};
	});