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

angular.module('vpdb.common', [])

	.controller('AboutController', function($scope) {
		$scope.theme('dark');
		$scope.setMenu('about');
		$scope.setTitle('About VPDB');
		$scope.setDescription('What VPDB is about and how it came to life.');
		$scope.setKeywords('vpdb, about, open source, accessible, beautiful, fast');

	})
	.controller('RulesController', function($scope) {
		$scope.theme('dark');
		$scope.setMenu('rules');
		$scope.setTitle('VPDB Rules');
		$scope.setDescription('It is a great community but a few rules are important nevertheless.');
		$scope.setKeywords('vpdb, rules, stern sam');

	})
	.controller('FaqController', function($scope) {
		$scope.theme('dark');
		$scope.setMenu('faq');
		$scope.setTitle('FAQ');
		$scope.setDescription('Answers to the most frequently asked questions.');
		$scope.setKeywords('vpdb, faq');

	})
	.controller('LegalController', function($scope, ConfigService) {
		$scope.theme('dark');
		$scope.setMenu('legal');
		$scope.setTitle('Terms of Use');
		$scope.setDescription('Terms and conditions of the VPDB website.');
		$scope.setKeywords('vpdb, legal, terms of use, terms and conditions');
		$scope.privacyUrl = ConfigService.webUri('/privacy');
	})
	.controller('PrivacyController', function($scope) {
		$scope.theme('dark');
		$scope.setMenu('privacy');
		$scope.setTitle('Privacy Policy');
		$scope.setDescription('Privacy policy of the VPDB website.');
		$scope.setKeywords('vpdb, legal, privacy policy');
	});
