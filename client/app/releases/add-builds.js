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

"use strict"; /* global _, angular */

angular.module('vpdb.releases.add', []).controller('AddBuildCtrl', function($scope, $modalInstance, $templateCache, ApiHelper, BuildResource) {

	$scope.build = {};

	// monkey patch template so it takes svgs instead of glyphicons.
	var dayTpl = $templateCache.get('template/datepicker/day.html');
	if (/<i class="glyphicon/.test(dayTpl)) {

		var monthTpl = $templateCache.get('template/datepicker/month.html');
		var yearTpl = $templateCache.get('template/datepicker/year.html');

		dayTpl = dayTpl.replace(/<i class="glyphicon glyphicon-chevron-left">/, '<svg class="svg-icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon-arrow-left"></use></svg>');
		dayTpl = dayTpl.replace(/<i class="glyphicon glyphicon-chevron-right">/, '<svg class="svg-icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon-arrow-right"></use></svg>');

		monthTpl = monthTpl.replace(/<i class="glyphicon glyphicon-chevron-right">/, '<svg class="svg-icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon-arrow-right"></use></svg>');
		monthTpl = monthTpl.replace(/<i class="glyphicon glyphicon-chevron-left">/, '<svg class="svg-icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon-arrow-left"></use></svg>');

		yearTpl = yearTpl.replace(/<i class="glyphicon glyphicon-chevron-right">/, '<svg class="svg-icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon-arrow-right"></use></svg>');
		yearTpl = yearTpl.replace(/<i class="glyphicon glyphicon-chevron-left">/, '<svg class="svg-icon"><use xmlns:xlink="http://www.w3.org/1999/xlink" xlink:href="#icon-arrow-left"></use></svg>');

		$templateCache.put('template/datepicker/day.html', dayTpl);
		$templateCache.put('template/datepicker/month.html', monthTpl);
		$templateCache.put('template/datepicker/year.html', yearTpl);
	}

	$scope.openCalendar = function($event) {
		$event.preventDefault();
		$event.stopPropagation();

		$scope.calendarOpened = true;
	};

	$scope.add = function() {
		BuildResource.save($scope.build, function(build) {
			$modalInstance.close(build);

		}, ApiHelper.handleErrors($scope));
	};
});