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

"use strict"; /* global _, angular */

angular.module('vpdb.releases.details', []).controller('ReleaseDetailsController', function(
	$scope, $rootScope, $uibModal, $timeout, $stateParams, $location, $localStorage,
	ApiHelper, ReleaseCommentResource, AuthService, ReleaseService, Flavors, TrackerService,
	ReleaseRatingResource, ReleaseResource, GameResource, ReleaseModerationCommentResource)
{

	$scope.theme('dark');
	$scope.setMenu('Release Details');
	$scope.gameId = $stateParams.id;
	$scope.releaseId = $stateParams.releaseId;
	$scope.flavors = Flavors;
	$scope.found = false;
	$scope.pageLoading = true;
	$scope.newComment = 'default text';
	$scope.zoneName = AuthService.hasPermission('releases/update') ? 'Admin' : 'Author';
	$scope.storage = $localStorage;

	$scope.ldRelease = {
		"@context": "http://schema.org/",
		"@type": "Product"
	};

	// GAME
	$scope.game = GameResource.get({ id: $scope.gameId });

	// RELEASE
	ReleaseResource.get({ release: $scope.releaseId }, function(release) {

		var title = release.game.title + ' · ' + release.name;
		$scope.release = release;
		$scope.pageLoading = false;
		$scope.found = true;
		$scope.setTitle(title);
		$scope.setDescription(release.description);
		$scope.setKeywords([release.game.title, release.name, 'Download', 'Visual Pinball'].join(',')); // TODO add FP when supported
		TrackerService.trackPage();

		// moderation toggle
		if ($location.search()['show-moderation']) {
			$scope.showModeration = true;
			$location.search('show-moderation', null);
		} else {
			$scope.showModeration = release.moderation && !release.moderation.is_approved;
		}

		// sort versions
		$scope.releaseVersions = _.sortByOrder(release.versions, 'released_at', false);
		$scope.latestVersion = $scope.releaseVersions[0];

		// get latest shots
		$scope.shots = _.sortByOrder(_.compact(_.map($scope.latestVersion.files, function(file) {
			if (!file.playfield_image) {
				return null;
			}
			return {
				type: file.playfield_image.file_type,
				url: file.playfield_image.variations['medium' + $rootScope.pixelDensitySuffix].url,
				full: file.playfield_image.variations.full.url
			};
		})), 'type', true);

		// fetch comments
		$scope.comments = ReleaseCommentResource.query({ releaseId: release.id });
		if (release.moderation) {
			$scope.moderationComments = ReleaseModerationCommentResource.query({ releaseId: release.id });
		}

		// mod permissions
		if (release.license === 'by-sa') {
			$scope.modPermission = 'This release can be freely modded when properly credited, without explicit permission from the author' + (release.authors.length === 1 ? '' : 's') + '.';
		} else {
			$scope.modPermission = 'This release cannot be freely modded and needs explicit permissions from the author' + (release.authors.length === 1 ? '' : 's') + '.';
		}

		$scope.flavorGrid = ReleaseService.flavorGrid(release);

		// setup lightbox
		$timeout(function() {
			$('.carousel-inner').each(function() {
				$(this).magnificPopup({
					delegate: '.image',
					type: 'image',
					removalDelay: 300,
					mainClass: 'mfp-fade',
					gallery: {
						enabled: true,
						preload: [0,2],
						navigateByImgClick: true,
						arrowMarkup: '',
						tPrev: '',
						tNext: '',
						tCounter: ''
					}
				});
			});
		});

		// seo structured data
		$scope.ldRelease.name = title;
		if (release.description) {
			$scope.ldRelease.description = release.description;
		}
		$scope.ldRelease.brand = _.map(release.authors, 'user.name').join(', ');

		var playfieldImage;
		_.forEach(release.versions, function(version) {
			_.forEach(version.files, function(file) {
				// prefer landscape shot
				if (!playfieldImage || (file.playfield_image.file_type === 'playfield-ws' && playfieldImage.file_type !== 'playfield-ws')) {
					playfieldImage = file.playfield_image;
				}
			});
		});
		if (playfieldImage) {
			$scope.ldRelease.image = playfieldImage.variations['medium'].url;
			$scope.setThumbnail(playfieldImage.variations['medium'].url);
		}

		if (release.rating.votes) {
			$scope.ldRelease.aggregateRating = {
				"@type": "AggregateRating",
				"ratingValue": release.rating.average,
				"bestRating": "10",
				"worstRating": "1",
				"ratingCount": release.rating.votes
			};
		}

	}, function(err) {
		console.error(err);
		$scope.pageLoading = false;
		$scope.found = false;
	});

	// setup comments
	$scope.newComment = '';
	$scope.addComment = function() {
		ReleaseCommentResource.save({ releaseId: $scope.releaseId }, { message: $scope.newComment }, function(comment) {
			$scope.comments.unshift(comment);
			$scope.newComment = '';
		}, ApiHelper.handleErrors($scope));
	};
	$scope.addModerationComment = function() {
		ReleaseModerationCommentResource.save({ releaseId: $scope.releaseId }, { message: $scope.newModerationComment }, function(comment) {
			$scope.moderationComments.push(comment);
			$scope.newModerationComment = '';
		}, ApiHelper.handleErrors($scope));
	};

	// ratings
	if (AuthService.hasPermission('releases/rate')) {
		ReleaseRatingResource.get({ releaseId: $scope.releaseId }).$promise.then(function(rating) {
			$scope.releaseRating = rating.value;
		});
	}

	/**
	 * Opens the game download dialog
	 *
	 * @param game Game
	 */
	$scope.download = function(game) {

		if (AuthService.isAuthenticated) {
			$uibModal.open({
				templateUrl: '/releases/modal-download.html',
				controller: 'DownloadGameCtrl',
				size: 'lg',
				resolve: {
					params: function() {
						return {
							game: game,
							release: $scope.release,
							latestVersion: $scope.latestVersion
						};
					}
				}
			});

		} else {
			$rootScope.login({
				headMessage: 'In order to download this release, you need to be logged in. You can register for free just below.'
			});
		}
	};

	/**
	 * Rates a release
	 * @param rating Rating
	 */
	$scope.rateRelease = function(rating) {
		var done = function(result) {
			$scope.release.rating = result.release;
			$scope.releaseRating = rating;
		};
		if ($scope.releaseRating) {
			ReleaseRatingResource.update({ releaseId: $scope.release.id }, { value: rating }, done);
			$rootScope.showNotification('Successfully updated rating.');

		} else {
			ReleaseRatingResource.save({ releaseId: $scope.release.id }, { value: rating }, done);
			$rootScope.showNotification('Successfully rated release!');
		}
	};


	$scope.validateFile = function(release, version, file) {
		$uibModal.open({
			templateUrl: '/releases/modal-file-validation.html',
			controller: 'FileValidationCtrl',
			resolve: {
				params: function() {
					return {
						release: release,
						version: version,
						file: file,
					};
				}
			}
		}).result.then(function(validation) {
			if (validation) {
				file.validation = validation
			}
		})
	}

}).controller('DownloadGameCtrl', function($scope, $uibModalInstance, $timeout, Flavors, RomResource, DownloadService, params) {

	$scope.game = params.game;
	$scope.release = params.release;
	$scope.latestVersion = params.latestVersion;
	$scope.flavors = Flavors;
	$scope.includeGameMedia = false;

	$scope.gameMedia = $scope.game.media;
	$scope.roms = RomResource.query({ id: $scope.game.id });

	$scope.downloadFiles = {};
	$scope.downloadRequest = {
		files: [],
		media: {
			playfield_image: true,
			playfield_video: false
		},
		backglass: null,
		game_media: [],
		roms: []
	};

	$scope.download = function() {
		DownloadService.downloadRelease($scope.release.id, $scope.downloadRequest, function() {
			$uibModalInstance.close(true);
		});
	};

	$scope.toggleFile = function(file) {
		if ($scope.downloadFiles[file.file.id]) {
			delete $scope.downloadFiles[file.file.id];
		} else {
			$scope.downloadFiles[file.file.id] = file;
		}
		$scope.downloadRequest.files = _.values(_.pluck(_.pluck($scope.downloadFiles, 'file'), 'id'));
	};

	$scope.selectBackglass = function(backglass) {
		if (backglass.id === $scope.downloadRequest.backglass) {
			$scope.downloadRequest.backglass = null;
		} else {
			$scope.downloadRequest.backglass = backglass.id;
		}
	};

	$scope.toggleRom = function(rom) {
		if (!_.contains($scope.downloadRequest.roms, rom.id)) {
			$scope.downloadRequest.roms.push(rom.id);
		} else {
			$scope.downloadRequest.roms.splice($scope.downloadRequest.roms.indexOf(rom.id), 1);
		}
	};

	$scope.$watch('includeGameMedia',  function() {
		$scope.downloadRequest.game_media = [];
		if ($scope.includeGameMedia) {
			var addedCategories = [];
			_.each($scope.gameMedia, function(media) {
				if (!_.contains(addedCategories, media.category)) {
					$scope.downloadRequest.game_media.push(media.id);
				}
				addedCategories.push(media.category)
			});
		}
	});

	if (!_.isEmpty($scope.gameMedia)) {
		$scope.includeGameMedia = true;
	}


	// todo refactor (make it more useful)
	$scope.tableFile = function(file) {
		return file.file.mime_type && /^application\/x-visual-pinball-table/i.test(file.file.mime_type);
	};

	var tableFiles = _.filter($scope.latestVersion.files, $scope.tableFile);
	if (tableFiles.length == 1) {
		$scope.toggleFile(tableFiles[0]);
	}

}).controller('FileValidationCtrl', function($scope, $rootScope, $uibModalInstance, ReleaseFileValidationResource, ApiHelper, params) {

	if (!params.file.validation) {
		$scope.message = 'This file has not been validated yet. Nothing more to see. ';
	} else {
		$scope.message = 'This file has been validated by ' + params.file.validation.validated_by.name + '. ';
		switch (params.file.validation.status) {
			case 'verified':
				break;
			case 'playable':
				$scope.message += 'There seems to be a minor problem but the file is still playable.';
				break;
			case 'broken':
				$scope.message += 'There seems to be a problems but the file is still playable.';
				break;
		}
		$scope.message += 'More details below:';
	}


	$scope.validation = _.cloneDeep(params.file.validation || {});
	$scope.file = params.file;
	$scope.statuses = [
		{ name: 'verified', description: 'The file has been verified and everything is okay.'},
		{ name: 'playable', description: 'Problems so minor that the release is still playable.'},
		{ name: 'broken', description: 'Major problems resulting in an unplayable file.'}
	];

	if (!$scope.validation.message) {
		$scope.validation.message = 'Checked and made sure that:\n\n- DOF config up is to date\n- `controller.vbs` is up to date\n- SoundFX calls are working'
	}

	$scope.submit = function() {
		ReleaseFileValidationResource.save({ releaseId: params.release.id, version: params.version, fileId: params.file.file.id }, $scope.validation, function(validation) {
			$rootScope.showNotification('Successfully saved new validation status.');
			$uibModalInstance.close(validation);

		}, ApiHelper.handleErrors($scope));
	}

}).filter('validationStatus', function() {
	return function(validation, displayName) {
		var name = validation ? validation.status : 'unknown';
		if (displayName) {
			return name[0].toUpperCase() + name.substring(1);
		}
		return name;
	};

}).filter('validationTooltip', function() {
	return function(validation) {
		if (!validation) {
			return "This file hasn't been validated yet.";
		}
		switch (validation.status) {
			case 'verified': return 'This file has been validated by a moderator.';
			case 'playable': return 'There are minor problems but the file is still playable.';
			case 'broken': return 'This file has been reported to be broken.';
		}
	};
});


/**
 * Takes a sorted list of versions and removes files that have a newer
 * flavor. Also removes empty versions.
 * @param versions
 * @param opts
 */
function stripFiles(versions) {
	var i, j;
	var flavorValues, flavorKey, flavorKeys = {};

	for (i = 0; i < versions.length; i++) {
		for (j = 0; j < versions[i].files.length; j++) {

			// if non-table file, skip
			if (!versions[i].files[j].flavor) {
				continue;
			}

			flavorValues = [];
			for (var key in flavor.values) {
				//noinspection JSUnfilteredForInLoop
				flavorValues.push(versions[i].files[j].flavor[key]);
			}
			flavorKey = flavorValues.join(':');

			// strip if already available
			if (flavorKeys[flavorKey]) {
				versions[i].files[j] = null;
			}
			flavorKeys[flavorKey] = true;
		}

		versions[i].files = _.compact(versions[i].files);

		// remove version if no more files
		if (versions[i].files.length === 0) {
			versions[i] = null;
		}
	}
	return _.compact(versions);
}