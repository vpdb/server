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

angular.module('vpdb.releases.list', [])

	.controller('ReleaseListController', function($scope, $rootScope, $http, $localStorage, $templateCache, $location,
												  ApiHelper, Flavors,
												  ReleaseResource, TagResource, BuildResource) {

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
		$scope.flavorFilter = { orientation: '', lighting: '' };
		$scope.filterTags = [];
		$scope.filterBuilds = [];
		$scope.filterFlavorOpen = { };
		$scope.sort = 'title';

		// stuff we need in the view
		$scope.Math = window.Math;
		$scope.flavors = _.values(Flavors);

		$scope.tags = TagResource.query();
		$scope.builds = BuildResource.query();

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
					thumbFormat = 'medium' + $rootScope.pixelDensitySuffix;
					break;
				default:
					thumbFormat = 'square' + $rootScope.pixelDensitySuffix;
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

			// filter by starred
			if ($scope.starredOnly) {
				query.starred = 1;
			}

			// filter by tags
			if ($scope.filterTags.length) {
				query.tags = $scope.filterTags.join(',');
			} else {
				delete query.tags;
			}

			// filter by builds
			if ($scope.filterBuilds.length) {
				query.builds = $scope.filterBuilds.join(',');
			} else {
				delete query.builds;
			}

			// filter by flavor
			var queryFlavors = [];
			for (f in $scope.flavorFilter) {
				if ($scope.flavorFilter.hasOwnProperty(f) && $scope.flavorFilter[f]) {
					queryFlavors.push(f + ':' + $scope.flavorFilter[f]);
				}
			}
			if (queryFlavors.length > 0) {
				query.flavor = queryFlavors.join(',');
			} else {
				delete query.flavor;
			}

			query = _.extend(query, queryOverride);
			$location.search(queryToUrl(query));

			// refresh if changes
			if (!_.isEqual($scope.$query, query)) {
				$scope.loading = true;
				$scope.releases = ReleaseResource.query(query, ApiHelper.handlePagination($scope, { loader: true }), ApiHelper.handleErrors($scope));
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
		if (urlQuery.starred) {
			$scope.starredOnly = true;
		}
		if (urlQuery.page) {
			$scope.page = urlQuery.page;
		}
		if (urlQuery.sort) {
			$scope.sort = urlQuery.sort;
		}
		if (urlQuery.tags) {
			$scope.filterTagOpen = true;
			$scope.filterTags = urlQuery.tags.split(',');
		}
		if (urlQuery.builds) {
			$scope.filterBuildOpen = true;
			$scope.filterBuilds = urlQuery.builds.split(',');
		}
		if (urlQuery.flavor) {
			var f, queryFlavors = urlQuery.flavor.split(',');
			for (var i = 0; i < queryFlavors.length; i++) {
				f = queryFlavors[i].split(':');
				$scope.filterFlavorOpen[f[0]] = true;
				$scope.flavorFilter[f[0]] = f[1]
			}
		}

		$scope.$watch('q', refresh);
		$scope.$watch('starredOnly', refresh);

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

		$scope.$on('dataToggleBuild', function(event, build) {
			if (_.contains($scope.filterBuilds, build)) {
				$scope.filterBuilds.splice($scope.filterBuilds.indexOf(build), 1);
			} else {
				$scope.filterBuilds.push(build);
			}
			refresh({});
		});

		$scope.onFlavorChange = function() {
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
	})

	.directive('filterBuild', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				if (_.contains(scope.filterBuilds, attrs.filterBuild)) {
					element.addClass('active');
				}
				element.click(function() {
					element.toggleClass('active');
					scope.$emit('dataToggleBuild', attrs.filterBuild, element.hasClass('active'));
				});
			}
		};
	});


