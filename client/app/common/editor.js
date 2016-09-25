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
	.directive('editor', function() {

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

		function moveToWordStart(text, start, delimiter) {
			delimiter = delimiter || /^\s$/;
			var b = false;
			for (var n = start; n >= 0; n--) {
				if (delimiter.test(text.substring(n - 1, n))) {
					start = n;
					b = true;
					break;
				}
			}
			if (!b) {
				start = 0;
			}
			return start;
		}

		function moveToWordEnd(text, end, delimiter) {
			delimiter = delimiter || /^\s$/;
			var b = false;
			for (var n = end; n < text.length; n++) {
				if (delimiter.test(text.substring(n, n + 1))) {
					end = n;
					b = true;
					break;
				}
			}
			if (!b) {
				end = text.length;
			}
			return end;
		}

		function wrap(element, text, chars) {
			text = text || '';
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
				start = moveToWordStart(text, start);
				end = moveToWordEnd(text, start);
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

		function wrapOnNewLine(element, text, prefixChars, suffixChars) {
			suffixChars = suffixChars || '';
			var start = element.prop('selectionStart');
			var end = element.prop('selectionEnd');
			var initialStart = start;
			var initialEnd = end;
			var block, selStart, selEnd;

			// trim empty lines
			text = text.replace(/ +\n/g, '\n');
			var lineStart = moveToWordStart(text, start, /^\n$/);
			var lineEnd = moveToWordEnd(text, end, /^\n$/);
			var numLines = text.slice(start, end).split('\n').length;

			// check if already prefixed and remove
			if (text.substring(lineStart, lineStart + prefixChars.length) === prefixChars) {
				if (numLines > 1) {
					let block = text.slice(lineStart + prefixChars.length, lineEnd).replace(new RegExp(_.escapeRegExp('\n' + prefixChars), 'g'), '\n');
					return {
						text: [text.slice(0, lineStart), block, text.slice(end)].join(''),
						start: lineStart,
						end: lineStart + block.length
					}

				} else {
					return {
						text: [text.slice(0, lineStart), text.slice(lineStart + prefixChars.length)].join(''),
						start: start - prefixChars.length,
						end: end - prefixChars.length
					}
				}
			}

			// if no selection, expand selection to current word
			if (start === end) {
				start = moveToWordStart(text, start);
				end = moveToWordEnd(text, start);
			}
			// if multiple lines selected, expand selection to paragraph
			if (numLines > 1) {
				start = lineStart;
				end = lineEnd;
			}

			var prefix = '';
			var suffix = '';
			if (start > 0 && text.substring(start - 1, start) != '\n') {
				prefix += '\n';
			}
			if (start > 0 && text.substring(start - 2, start - 1) != '\n') {
				prefix += '\n';
			}
			if (end < text.length && text.substring(end, end + 1) != '\n') {
				suffix += '\n';
			}
			if (end < text.length && text.substring(end + 1, end + 2) != '\n') {
				suffix += '\n';
			}
			// if no suffix chars given, prefix every line.
			if (!suffixChars) {

				block = prefixChars + text.substring(start, end).split('\n').join('\n' + prefixChars);
				if (numLines > 1) {
					selStart = start + prefix.length;
					selEnd = start + prefix.length + block.length;
				} else {
					selStart = initialStart + prefix.length + prefixChars.length;
					selEnd = initialEnd + prefix.length + prefixChars.length;
				}

			} else {
				block = [prefixChars, text.slice(start, end), suffixChars].join('');
				selStart = initialStart + prefix.length + prefixChars.length;
				selEnd = initialEnd + prefix.length + prefixChars.length;
			}
			return {
				text: [text.slice(0, start), prefix, block, suffix, text.slice(end)].join(''),
				start: selStart,
				end: selEnd
			}
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
					apply(textarea, $scope, wrap(textarea, $scope.text, '**'));
				};

				$scope.textItalic = function() {
					var textarea = $element.find('textarea');
					apply(textarea, $scope, wrap(textarea, $scope.text, '_'));
				};

				$scope.textQuote = function() {
					var textarea = $element.find('textarea');
					apply(textarea, $scope, wrapOnNewLine(textarea, $scope.text, '> '));
				};

				$scope.textCode = function() {
					var textarea = $element.find('textarea');
					var start = textarea.prop('selectionStart');
					var end = textarea.prop('selectionEnd');
					// if selection has line break, wrap on new line
					if (/\n+/.test($scope.text.substring(start, end))) {
						apply(textarea, $scope, wrapOnNewLine(textarea, $scope.text, '```\n', '\n```'));
					} else {
						apply(textarea, $scope, wrap(textarea, $scope.text, '`'));
					}

				};
			}
		};
	});