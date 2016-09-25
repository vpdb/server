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
	.directive('editor', function(AuthService) {

		function matchAll(text, regex) {
			regex = new RegExp(regex.source, 'gi');
			var match, matches = [];
			while (match = regex.exec(text)) {
				matches.push(match);
			}
			return matches;
		}

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

		function wrapSelect(element, text, prefixChars, suffixChars, regex, select) {
			text = text || '';
			var start = element.prop('selectionStart');
			var end = element.prop('selectionEnd');

			// check if we should remove it
			var matches = matchAll(text, regex);
			for (var i = 0; i < matches.length; i++) {
				if (matches[i].index < start && (matches[i].index + matches[i][0].length) > end) {
					return {
						text: [text.substring(0, matches[i].index), matches[i][1], text.substring(matches[i].index + matches[i][0].length)].join(''),
						start: matches[i].index,
						end: matches[i].index + matches[i][1].length
					}
				}
			}

			// check if current word is already wrapped in chars
			if (start === end && end !== text.length) {
				start = moveToWordStart(text, start);
				end = moveToWordEnd(text, start);
			}

			var block = [text.substring(0, start), prefixChars, text.substring(start, end), suffixChars, text.substring(end)].join('');
			return {
				text: block,
				start: start === end ? start + prefixChars.length : prefixChars.length + end + select.start,
				end: start === end ? end + prefixChars.length : prefixChars.length + end + select.end
			}
		}

		function wrap(element, text, chars) {
			text = text || '';
			var start = element.prop('selectionStart');
			var end = element.prop('selectionEnd');
			var selection = start === end ? start : -1;

			// REMOVE
			// ----------------------------------------------------------------
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

			// ADD
			// ----------------------------------------------------------------
			return {
				text: [text.slice(0, start), chars, text.slice(start, end), chars, text.slice(end)].join(''),
				start: (selection < 0 ? start : selection) + chars.length,
				end: (selection < 0 ? end : selection) + chars.length
			}
		}

		function wrapOnNewLine(element, text, prefixChars, prefixRegex, suffixChars) {
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

			// REMOVE
			// ----------------------------------------------------------------
			if (!suffixChars) {
				var matchPrefix = new RegExp('^' + prefixRegex.source);
				if (matchPrefix.test(text.substring(lineStart))) {
					if (numLines > 1) {
						let block = text.slice(lineStart, lineEnd).replace(new RegExp('(\n|^)' + prefixRegex.source, 'g'), '$1');
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
			} else {
				if (lineStart > prefixChars.length && text.substring(lineStart - prefixChars.length, lineStart) === prefixChars &&
				    lineEnd + suffixChars.length <= text.length && text.substring(lineEnd, lineEnd + suffixChars.length) === suffixChars) {
					return {
						text: [text.slice(0, lineStart - prefixChars.length), text.slice(lineStart, lineEnd), text.slice(lineEnd + suffixChars.length)].join(''),
						start: lineStart - prefixChars.length,
						end: lineEnd - prefixChars.length
					}
				}
			}

			// if no selection, expand selection to current word
			if (start === end) {
				start = moveToWordStart(text, start);
				end = moveToWordEnd(text, start);
			}

			// compute prefix/suffix newlines
			var prefixLF = '';
			var suffixLF = '';
			if (start > 0 && text.substring(start - 1, start) != '\n') {
				prefixLF += '\n';
			}
			if (start > 0 && text.substring(start - 2, start - 1) != '\n') {
				prefixLF += '\n';
			}
			if (end < text.length && text.substring(end, end + 1) != '\n') {
				suffixLF += '\n';
			}
			if (end < text.length && text.substring(end + 1, end + 2) != '\n') {
				suffixLF += '\n';
			}

			// ADD
			// ----------------------------------------------------------------
			if (!suffixChars) {
				// if no suffix chars given, prefix every line.
				block = prefixChars + text.substring(start, end).split('\n').join('\n' + prefixChars);
				var n = 1;
				block = block.replace(/(\\d)/g, function() { return n++; });
				if (numLines > 1) {
					selStart = start + prefixLF.length;
					selEnd = start + prefixLF.length + block.length;
				} else {
					selStart = initialStart + prefixLF.length + prefixChars.length;
					selEnd = initialEnd + prefixLF.length + prefixChars.length;
				}

			} else {
				block = [prefixChars, text.substring(start, end), suffixChars].join('');
				selStart = initialStart + prefixLF.length + prefixChars.length;
				selEnd = selStart + block.length - prefixChars.length - suffixChars.length;
			}
			return {
				text: [text.slice(0, start), prefixLF, block, suffixLF, text.slice(end)].join(''),
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

				$scope.auth = AuthService;

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
					apply(textarea, $scope, wrapOnNewLine(textarea, $scope.text, '> ', /> /));
				};

				$scope.textCode = function() {
					var textarea = $element.find('textarea');
					var start = textarea.prop('selectionStart');
					var end = textarea.prop('selectionEnd');
					// if selection has line break, wrap on new line
					if (/\n+/.test($scope.text.substring(start, end))) {
						apply(textarea, $scope, wrapOnNewLine(textarea, $scope.text, '```\n', /```\n/, '\n```'));
					} else {
						apply(textarea, $scope, wrap(textarea, $scope.text, '`'));
					}
				};

				$scope.textUnorderedList = function() {
					var textarea = $element.find('textarea');
					apply(textarea, $scope, wrapOnNewLine(textarea, $scope.text, '- ', /- /));
				};

				$scope.textOrderedList = function() {
					var textarea = $element.find('textarea');
					apply(textarea, $scope, wrapOnNewLine(textarea, $scope.text, '\\d. ', /\d+\. /));
				};

				$scope.textLink = function() {
					var textarea = $element.find('textarea');
					apply(textarea, $scope, wrapSelect(textarea, $scope.text, '[', '](url)', /\[(.*?)\]\([^\)]+\)/i, { start: 2, end: 5 }));
				};
			}
		};
	});