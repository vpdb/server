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

"use strict";
/* global angular, _ */

angular.module('vpdb.rating', [])

	/**
	 * Use like this:
	 *
	 *  rating-avg="game.rating.average",
	 *  rating-votes="game.rating.votes",
	 *  rating-user="gameRating"
	 *  rating-action="rateGame($rating)"
	 */
	.directive('ratingbox', function($parse) {
		return {
			restrict: 'C',
			scope: true,
			templateUrl: 'template/rating.html',
			link: function(scope, elem) {
				elem.mouseenter(function() {
					scope.editStart();
					scope.$apply();
				});
				elem.mouseleave(function() {
					scope.editEnd();
					scope.$apply();
				});
			},
			controller: function($scope, $element, $attrs) {
				var ratingAvg = $parse($attrs.ratingAvg);
				var ratingUser = $parse($attrs.ratingUser);

				// init: read average rating
				$scope.$watch(ratingAvg, function(rating) {
					if (rating && !$scope.boxHovering) {
						$scope.rating = rating;
						$scope.value = rating;
					}
				});

				// init: read number of votes
				$scope.$watch($parse($attrs.ratingVotes), function(votes) {
					if (votes) {
						$scope.ratingVotes = votes;
					}
				});


				/**
				 * Cursor enters rating box.
				 *
				 * => Display the user's rating
				 */
				$scope.editStart = function() {
					var rating = ratingUser($scope);
					$scope.boxHovering = true;
					$scope.rating = rating;
					$scope.value = rating;
				};

				/**
				 * Cursor leaves rating box.
				 *
				 * => Display average rating
				 */
				$scope.editEnd = function() {
					var rating = ratingAvg($scope);
					$scope.boxHovering = false;
					$scope.rating = rating;
					$scope.value = rating;
				};

				/**
				 * Cursor enters stars.
				 *
				 * => Display hovered rating.
				 *
				 * @param {int} value Star value (1-10)
				 */
				$scope.rateStart = function(value) {
					if (!$scope.readonly) {
						$scope.starHovering = true;
						$scope.value = value;
						$scope.rating = value;
					}
				};

				/**
				 * Cursor leaves stars
				 *
				 * => Display user rating
				 */
				$scope.rateEnd = function() {
					var rating = ratingUser($scope);
					$scope.starHovering = false;
					$scope.rating = rating;
					$scope.value = rating;
				};

				// a star has been clicked
				$scope.rate = function() {
					$scope.$rating = $scope.value;
					$parse($attrs.ratingAction)($scope)
				};
			}
		};
	});
