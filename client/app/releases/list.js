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

angular.module('vpdb.releases.list', [])

	.controller('ReleaseListController', function($scope, $rootScope, $http, $localStorage, $templateCache, $location,
												  ApiHelper, Flavors,
												  ReleaseResource, TagResource) {

		// view type config
		var viewTypes = [ 'extended', 'table' ];
		var defaultViewType = 'compact';
		var thumbFormat;

		$localStorage.releases = $localStorage.releases || {};

		// theme & menu
		$scope.theme('dark');
		$scope.setTitle('Releases');
		$scope.setMenu('releases');

		// query defaults
		$scope.$query = null;
		$scope.flavorFilter = {};
		$scope.filterTags = [];
		$scope.filterOrientationOpen = true;
		$scope.sort = 'title';

		// stuff we need in the view
		$scope.Math = window.Math;
		$scope.flavors = _.values(Flavors);

		$scope.tags = TagResource.query();

		// preload partials
		_.each(['compact', 'extended' ], function(view) {
			$http.get('/releases/list-' + view + '.html', { cache: $templateCache });
		});

		// view types logic
		var viewtype = $localStorage.releases.viewtype || defaultViewType;
		$scope.viewtype = _.contains(viewTypes, viewtype) ? viewtype : defaultViewType;
		$scope.setViewTemplate = function(view) {
			switch (view) {
				case 'compact':
					thumbFormat = 'medium';
					break;
				default:
					thumbFormat = 'square';
			}
			$scope.template = '/releases/list-' + view + '.html';
		};
		$scope.switchview = function(view) {
			if ($scope.viewtype === view) {
				return;
			}
			$localStorage.releases.viewtype = view;
			$scope.viewtype = view;
			$scope.setViewTemplate(view);
			refresh({});
		};
		$scope.setViewTemplate($scope.viewtype);
		var urlQuery = $location.search();


		// QUERY LOGIC
		// --------------------------------------------------------------------
		var refresh = function(queryOverride, firstRunCheck) {

			// ignore initial watches
			if (queryOverride === firstRunCheck) {
				return;
			}

			var query = { sort: $scope.sort, thumb_format: thumbFormat };
			console.log(query);
			if ($scope.firstQuery) {
				query.page = urlQuery.page;
				$scope.firstQuery = false;
			}
			queryOverride = queryOverride || {};

			// search query
			if ($scope.q && $scope.q.length > 2) {
				query.q = $scope.q;
			}
			if (!$scope.q) {
				delete query.q;
			}

			// filter by tags
			if ($scope.filterTags.length) {
				query.tag = $scope.filterTags.join(',');
			} else {
				delete query.tag;
			}

			// filter by orientation
			if ($scope.flavorFilter.orientation) {
				query.flavor = 'orientation:' + $scope.flavorFilter.orientation;
			}

			query = _.extend(query, queryOverride);
			$location.search(queryToUrl(query));

			// refresh if changes
			if (!_.isEqual($scope.$query, query)) {
				$scope.loading = true;
				$scope.releases = ReleaseResource.query(query, ApiHelper.handlePagination($scope, { loader: true }));
				$scope.$query = query;
			}
		};

		var queryToUrl = function(query) {
			var defaults = {
				sort: 'title',
				page: '1',
				per_page: '12'
			};
			var q = _.omit(query, function (value, key) {
				return defaults[key] === value;
			});
			delete q.thumb;
			return q;
		};

		// update scope with query variables TODO surely we can refactor this a bit?
		if (urlQuery.q) {
			$scope.q = urlQuery.q;
		}
		if (urlQuery.page) {
			$scope.page = urlQuery.page;
		}
		if (urlQuery.sort) {
			$scope.sort = urlQuery.sort;
		}
		if (urlQuery.tag) {
			$scope.filterTagOpen = true;
			$scope.filterTags = urlQuery.tag.split(',');
		}


		$scope.$watch('q', refresh);

		$scope.paginate = function(link) {
			refresh(link.query);
		};

		$scope.$on('dataChangeSort', function(event, field, direction) {
			$scope.sort = (direction === 'desc' ? '-' : '') + field;
			refresh({});
		});

		$scope.$on('dataToggleTag', function(event, tag) {
			if (_.contains($scope.filterTags, tag)) {
				$scope.filterTags.splice($scope.filterTags.indexOf(tag), 1);
			} else {
				$scope.filterTags.push(tag);
			}
			refresh({});
		});

		$scope.onFlavorChange = function() {
			console.log($scope.flavorFilter);
			refresh({});
		};

		refresh({});
	})


	.directive('filterTag', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				if (_.contains(scope.filterTags, attrs.filterTag)) {
					element.addClass('active');
				}
				element.click(function() {
					element.toggleClass('active');
					scope.$emit('dataToggleTag', attrs.filterTag, element.hasClass('active'));
				});
			}
		};
	});


