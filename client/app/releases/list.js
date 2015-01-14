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

angular.module('vpdb.releases.list', [])

	.controller('ReleaseListController', function($scope, $rootScope, $http, $localStorage, $templateCache, ApiHelper, ReleaseResource) {

		// view type config
		var viewTypes = [ 'extended', 'table' ];
		var defaultViewType = 'compact';

		$localStorage.releases = $localStorage.releases || {};

		// theme & menu
		$scope.theme('dark');
		$scope.setTitle('Releases');
		$scope.setMenu('releases');

		// query defaults
		$scope.$query = null;
		$scope.filterDecades = [];
		$scope.filterManufacturer = [];
		$scope.sort = 'title';

		// stuff we need in the view
		$scope.Math = window.Math;

		// preload partials
		_.each(['compact', 'extended' ], function(view) {
			$http.get('/releases/list-' + view + '.html', { cache: $templateCache });
		});

		// view types logic
		var viewtype = $localStorage.releases.viewtype || defaultViewType;
		$scope.viewtype = _.contains(viewTypes, viewtype) ? viewtype : defaultViewType;
		$scope.setViewTemplate = function(view) {
			$scope.template = '/releases/list-' + view + '.html';
		};
		$scope.switchview = function(view) {
			if ($scope.viewtype === view) {
				return;
			}
			$localStorage.releases.viewtype = view;
			$scope.viewtype = view;
			$scope.setViewTemplate(view);
		};
		$scope.setViewTemplate($scope.viewtype);


		// QUERY LOGIC
		// --------------------------------------------------------------------

		var refresh = function(queryOverride) {
			var query = { sort: $scope.sort, thumb: 'medium' };
			queryOverride = queryOverride || {};

			// search query
			if ($scope.q && $scope.q.length > 2) {
				query.q = $scope.q;
			}
			if (!$scope.q) {
				delete query.q;
			}

			// filter by decade
			if ($scope.filterDecades.length) {
				query.decade = $scope.filterDecades.join(',');
			} else {
				delete query.decade;
			}

			// filter by manufacturer
			if ($scope.filterManufacturer.length) {
				query.mfg = $scope.filterManufacturer.join(',');
			} else {
				delete query.mfg;
			}
			query = _.extend(query, queryOverride);

			// refresh if changes
			if (!_.isEqual($scope.$query, query)) {
				$scope.releases = ReleaseResource.query(query, ApiHelper.handlePagination($scope));
				$scope.$query = query;
			}
		};

		$scope.$watch('q', refresh);

		$scope.paginate = function(link) {
			refresh(link.query);
		};

		$scope.$on('dataChangeSort', function(event, field, direction) {
			$scope.sort = (direction === 'desc' ? '-' : '') + field;
			refresh();
		});

		$scope.$on('dataToggleDecade', function(event, decade) {
			if (_.contains($scope.filterDecades, decade)) {
				$scope.filterDecades.splice($scope.filterDecades.indexOf(decade), 1);
			} else {
				$scope.filterDecades.push(decade);
			}
			refresh();
		});

		$scope.$on('dataToggleManufacturer', function(event, manufacturer) {
			if (_.contains($scope.filterManufacturer, manufacturer)) {
				$scope.filterManufacturer.splice($scope.filterManufacturer.indexOf(manufacturer), 1);
			} else {
				$scope.filterManufacturer.push(manufacturer);
			}
			refresh();
		});
	});


