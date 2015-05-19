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
					scope.editing = true;
					scope.$apply();
				});
				elem.mouseleave(function() {
					scope.editing = false;
					scope.$apply();
				});
			},
			controller: function($scope, $element, $attrs) {
				$scope.$watch($parse($attrs.ratingAvg), function(ratingAvg) {
					if (ratingAvg) {
						$scope.ratingAvg = ratingAvg;
					}
				});
				$scope.$watch($parse($attrs.ratingVotes), function(votes) {
					if (votes) {
						$scope.ratingVotes = votes;
					}
				});
				$scope.$watch($parse($attrs.ratingUser), function(ratingUser) {
					if (ratingUser) {
						$scope.ratingUser = Math.round(ratingUser);
						$scope.ratingHover = Math.round(ratingUser);
					}
				});
				$scope.rate = function() {
					$scope.$rating = $scope.ratingUser;
					$parse($attrs.ratingAction)($scope)
				};
			}
		};
	})

	.controller('RatingController2', function($scope, $attrs, ratingConfig) {

		var ngModelCtrl = {$setViewValue: angular.noop};

		this.init = function(ngModelCtrl_) {
			ngModelCtrl = ngModelCtrl_;
			ngModelCtrl.$render = this.render;

			this.stateOn = angular.isDefined($attrs.stateOn) ? $scope.$parent.$eval($attrs.stateOn) : ratingConfig.stateOn;
			this.stateOff = angular.isDefined($attrs.stateOff) ? $scope.$parent.$eval($attrs.stateOff) : ratingConfig.stateOff;

			var ratingStates = angular.isDefined($attrs.ratingStates) ? $scope.$parent.$eval($attrs.ratingStates) :
				new Array(angular.isDefined($attrs.max) ? $scope.$parent.$eval($attrs.max) : ratingConfig.max);
			$scope.range = this.buildTemplateObjects(ratingStates);
		};

		this.buildTemplateObjects = function(states) {
			for (var i = 0, n = states.length; i < n; i++) {
				states[i] = angular.extend({index: i}, {stateOn: this.stateOn, stateOff: this.stateOff}, states[i]);
			}
			return states;
		};

		$scope.rate = function(value) {
			if (!$scope.readonly && value >= 0 && value <= $scope.range.length) {
				ngModelCtrl.$setViewValue(value);
				ngModelCtrl.$render();
			}
		};

		$scope.enter = function(value) {
			if (!$scope.readonly) {
				$scope.value = value;
			}
			$scope.onHover({value: value});
		};

		$scope.reset = function() {
			$scope.value = ngModelCtrl.$viewValue;
			$scope.onLeave();
		};

		this.render = function() {
			$scope.value = ngModelCtrl.$viewValue;
		};
	})

	.directive('rating2', function() {
		return {
			restrict: 'EA',
			require: ['rating2', 'ngModel'],
			scope: {
				readonly: '=?',
				onHover: '&',
				onLeave: '&'
			},
			controller: 'RatingController2',
			templateUrl: 'template/rating/rating.html',
			replace: true,
			link: function(scope, element, attrs, ctrls) {
				var ratingCtrl = ctrls[0], ngModelCtrl = ctrls[1];

				if (ngModelCtrl) {
					ratingCtrl.init(ngModelCtrl);
				}
			}
		};
	});
