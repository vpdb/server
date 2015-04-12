"use strict"; /* global _ */

angular.module('vpdb.releases.add', [])


	/**
	 * Main controller containing the form for adding a new release.
	 */
	.controller('ReleaseAddCtrl', function($scope, $upload, $modal, $window, $localStorage, $stateParams,
										   $location, $anchorScroll, $timeout,
										   AuthService, ApiHelper, Flavors,
										   ReleaseResource, FileResource, TagResource, BuildResource, GameResource,
										   ConfigService, DisplayService, MimeTypeService, ModalService) {

		$scope.theme('light');
		$scope.setMenu('admin');
		$scope.setTitle('Add Release');

		// define flavors
		$scope.flavors = _.values(Flavors);

		// fetch game info
		$scope.game = GameResource.get({ id: $stateParams.id }, function() {
			$scope.game.lastrelease = new Date($scope.game.lastrelease).getTime();
			$scope.release._game = $scope.game.id;
			$scope.setTitle('Add Release - ' + $scope.game.title);
		});

		// retrieve available tags
		$scope.tags = TagResource.query(function() {
			if ($scope.release && $scope.release._tags.length > 0) {
				// only push tags that aren't assigned yet.
				$scope.tags = _.filter($scope.tags, function(tag) {
					return !_.contains($scope.release._tags, tag.id);
				});
			}
		});

		// retrieve available vp builds
		var builds = BuildResource.query(function() {
			$scope.builds = {};
			var types = [];
			_.each(builds, function(build) {
				if (!$scope.builds[build.type]) {
					$scope.builds[build.type] = [];
					types.push(build.type);
				}
				build.built_at = new Date(build.built_at);
				$scope.builds[build.type].push(build);
			});
			_.each(types, function(type) {
				$scope.builds[type].sort(function(a, b) {
					return a.built_at.getTime() === b.built_at.getTime() ? 0 : (a.built_at.getTime() > b.built_at.getTime() ? -1 : 1);
				});
			});
		});

		/**
		 * Resets all entered data
		 */
		$scope.reset = function() {

			var currentUser = AuthService.getUser();

			/*
			 * `meta` is all the data we need for displaying the page but that
			 * is not part of the release object.
			 */
			$scope.meta = $localStorage.release_meta = {
				users: {},      // serves only for displaying purposes. key: id, value: full object

				/*
				 * Statuses of release files (those dropped under 1.)
				 *
				 * Example data:
				 * [
				 *   {
				 *     "name":"test_cabinet.vpt",
				 *     "bytes":606208,
				 *     "mimeType":"application/x-visual-pinball-table",
				 *     "icon":"ext-vpt",
				 *     "uploaded":false,
				 *     "uploading":false,
				 *     "progress":100,
				 *     "text":"Uploading file...",
				 *     "storage":{
				 *       "name":"Flippertest_cabinet.vpt",
				 *       "created_at":"2015-04-12T22:11:36.918Z",
				 *       "mime_type":"application/x-visual-pinball-table",
				 *       "file_type":"release",
				 *       "metadata":{ },
				 *       "id":"V1lt33C7-",
				 *       "url":"/storage/v1/files/V1lt33C7-",
				 *       "bytes":606208,
				 *       "variations":{ },
				 *       "is_protected":true,
				 *       "counter":{
				 *         "downloads":0
				 *       }
				 *     }
				 *   },
				 *   { ... }
				 * ]
				 *
				 * In order to get the actual release file, use {@link #getReleaseFile(file)}.
				 */
				files: [],      // that's the "driving" object, i.e. stuff gets pulled from this and also the view loops over it.
				tags: [],       // also driving object. on drop and remove, ids get copied into release object from here.
				mediaFiles: {}, // also driving object.

				/*
				 * Since we have different links for different file types (e.g. playfield image uses variation medium-landscape
				 * while playfield video uses variation.still), we save them separately for easy access.
				 *
				 * Example data:
				 *
				 * {
				 *   "playfield_image:4klWgD1E-":{
				 *     "url":"/storage/v1/files/VkGFqv14Z/medium-landscape",
				 *     "is_protected":true
				 *   }
				 * }
				 */
				mediaLinks: {}  // only for display purposes.
			};
			$scope.meta.users[currentUser.id] = currentUser;
			$scope.newLink = {};

			// TODO remove files via API

			$scope.release = $localStorage.release = {
				_game: $scope.game.id,
				name: '',
				description: '',
				versions: [ {
					version: '',
					changes: '*Initial release.*',
					files: [ ]
				} ],
				authors: [ {
					_user: currentUser.id,
					roles: [ 'Table Creator' ]
				} ],
				_tags: [ ],
				links: [ ],
				acknowledgements: '',
				original_version: null
			};

			$scope.errors = {};
		};


		/**
		 * Deletes an uploaded file from the server and removes it from the list
		 * @param {object} file
		 */
		$scope.removeFile = function(file) {
			FileResource.delete({ id: file.storage.id }, function() {
				$scope.meta.files.splice($scope.meta.files.indexOf(file), 1);
				$scope.release.versions[0].files.splice(_.indexOf($scope.release.versions[0].files, _.findWhere($scope.release.versions[0].files, { id : file.storage.id })), 1);

			}, ApiHelper.handleErrorsInDialog($scope, 'Error removing file.'));
		};


		/**
		 * Adds OR edits an author.
		 * @param {object} author If set, edit this author, otherwise add a new one.
		 */
		$scope.addAuthor = function(author) {
			$modal.open({
				templateUrl: '/releases/modal-author-add.html',
				controller: 'ChooseAuthorCtrl',
				resolve: {
					release: function() { return $scope.release; },
					meta: function() { return $scope.meta; },
					author: function() { return author; }
				}
			}).result.then(function(newAuthor) {

				// here we're getting the full object, so store the user object in meta.
				var authorRef = { _user: newAuthor.user.id, roles: newAuthor.roles };
				$scope.meta.users[newAuthor.user.id] = newAuthor.user;

				// add or edit?
				if (author) {
					$scope.release.authors[$scope.release.authors.indexOf(author)] = authorRef;
				} else {
					$scope.release.authors.push(authorRef);
				}
			});
		};


		/**
		 * Removes an author
		 * @param {object} author
		 */
		$scope.removeAuthor = function(author) {
			$scope.release.authors.splice($scope.release.authors.indexOf(author), 1);
		};


		/**
		 * Opens the create tag dialog
		 */
		$scope.createTag = function() {
			$modal.open({
				templateUrl: '/releases/modal-tag-create.html',
				controller: 'CreateTagCtrl'
			}).result.then(function(newTag) {
					$scope.tags.push(newTag);
				});
		};


		/**
		 * When a tag is dropped
		 */
		$scope.tagDropped = function() {
			$scope.release._tags = _.pluck($scope.meta.tags, 'id');
		};


		/**
		 * Removes a tag from the release
		 * @param {object} tag
		 */
		$scope.removeTag = function(tag) {
			$scope.meta.tags.splice($scope.meta.tags.indexOf(tag), 1);
			$scope.tags.push(tag);
			$scope.release._tags = _.pluck($scope.meta.tags, 'id');
		};


		/**
		 * Adds a link to the release
		 * @param {object} link
		 * @returns {{}}
		 */
		$scope.addLink = function(link) {
			$scope.release.links.push(link);
			return {};
		};


		/**
		 * Removes a link from the release
		 * @param {object} link
		 */
		$scope.removeLink = function(link) {
			$scope.release.links.splice($scope.release.links.indexOf(link), 1);
		};


		/**
		 * Adds or removes a build to/from to a given file of the release
		 * @param {object} file
		 * @param {object} build
		 */
		$scope.toggleBuild = function(file, build) {
			var idx = file.builds.indexOf(build.id);
			if (idx > -1) {
				file.builds.splice(idx, 1);
			} else {
				file.builds.push(build.id);
			}
		};


		/**
		 * Opens the dialog for creating a new build.
		 */
		$scope.addBuild = function() {
			$modal.open({
				templateUrl: '/releases/modal-build-create.html',
				controller: 'AddBuildCtrl',
				size: 'lg'
			}).result.then(function(newBuild) {
				// todo
			});
		};

		/**
		 * Callback when a file was successfully uploaded.
		 * @param status
		 */
		$scope.onFileUpload = function(status) {
			var tableFile;
			if (/^application\/x-visual-pinball-table/i.test(status.mimeType)) {
				tableFile = {
					_file: status.storage.id,
					flavor: {},
					_compatibility: [],
					_media: {
						playfield_image: null,
						playfield_video: null
					}
				};
			} else {
				tableFile = { _file: status.storage.id };
			}
			$scope.release.versions[0].files.push(tableFile);
		};

		$scope.onMediaUpload = function(status) {

			// update links
			if (/^image\//.test(status.mimeType)) {
				$scope.meta.mediaLinks[status.key] = status.storage.variations['medium-landscape'];

			} else if (/^video\//.test(status.mimeType)) {
				$scope.meta.mediaLinks[status.key] = status.storage.variations.still;

			} else {
				$scope.meta.mediaLinks[status.key] = status.storage;
			}
			AuthService.collectUrlProps(status.storage, true);
		};

		$scope.onMediaClear = function(key) {
			$scope.meta.mediaLinks[key] = false;
		};

		$scope.getReleaseFile = function(file) {
			return _.find($scope.release.versions[0].files, { _file: file.storage.id });
		};
		$scope.getPlayfieldType = function(file) {
			var releaseFile = $scope.getReleaseFile(file);
			// fullscreen per default
			return 'playfield-' + (releaseFile && releaseFile.flavor && releaseFile.flavor.orientation === 'ws' ? 'ws' : 'fs');
		};
		$scope.getMediaKey = function(file, type) {
			return type + ':' + file.storage.id;
		};


		/**
		 * When an image or video is dropped in the media section
		 *
		 * Statuses
		 *
		 * - uploading
		 * - extracting still
		 * - generating thumb
		 * - finished
		 *
		 * @param {object} tableFile Table file uploaded above
		 * @param {string} type Media type, e.g. "playfield_image" or "playfield_video"
		 * @param {array} $files Uploaded file(s), assuming that one was chosen.
		 */
		$scope.___onMediaUpload = function(tableFile, type, $files) {

			var tableFileId = tableFile.storage.id;

			var file = $files[0];
			var mimeType = MimeTypeService.fromFile(file);

			// init
			_.defaults($scope, { mediaFiles: {}});
			$scope.mediaFiles[tableFileId] = $scope.mediaFiles[tableFileId] || {};
			$scope.mediaFiles[tableFileId][type] = {};
			$scope.meta.mediaFiles[tableFileId] = $scope.meta.mediaFiles[tableFileId] || {};
			$scope.meta.mediaLinks[tableFileId] = $scope.meta.mediaLinks[tableFileId] || {};

			if ($scope.meta.mediaFiles[tableFileId][type] && $scope.meta.mediaFiles[tableFileId][type].id) {
				FileResource.delete({ id : $scope.meta.mediaFiles[tableFileId][type].id });
				$scope.meta.mediaLinks[tableFileId][type] = false;
				this.$emit('imageUnloaded');
			}

			// upload image
			var fileReader = new FileReader();
			fileReader.readAsArrayBuffer(file);
			fileReader.onload = function(event) {

				$scope.meta.mediaFiles[tableFileId][type] = {};
				$scope.meta.mediaLinks[tableFileId][type] = false;
				$scope.mediaFiles[tableFileId][type].uploaded = false;
				$scope.mediaFiles[tableFileId][type].uploading = true;
				$scope.mediaFiles[tableFileId][type].status = 'Uploading file...';
				$upload.http({
					url: ConfigService.storageUri('/files'),
					method: 'POST',
					params: { type: 'playfield-' + (tableFile.flavor.orientation === 'ws' ? 'ws' : 'fs') }, // fullscreen per default
					headers: {
						'Content-Type': mimeType,
						'Content-Disposition': 'attachment; filename="' + file.name + '"'
					},
					data: event.target.result

				}).then(function(response) {
					$scope.mediaFiles[tableFileId][type].uploading = false;
					$scope.mediaFiles[tableFileId][type].status = 'Uploaded';

					var mediaResult = response.data;
					$scope.meta.mediaFiles[tableFileId][type] = mediaResult;

					switch (type) {
						case 'playfield_image':
							$scope.meta.mediaLinks[tableFileId][type] = mediaResult.variations['medium-landscape'];
							break;
						case 'playfield_video':
							$scope.meta.mediaLinks[tableFileId][type] = mediaResult.variations.still;
							break;
						default:
							$scope.meta.mediaLinks[tableFileId][type] = mediaResult;
					}
					AuthService.collectUrlProps(mediaResult, true);

					updateReleaseMedia($scope.meta.mediaFiles, $scope.release);

				}, ApiHelper.handleErrorsInDialog($scope, 'Error uploading image.', function() {


				}), function (evt) {
					$scope.mediaFiles[tableFileId][type].progress = parseInt(100.0 * evt.loaded / evt.total);
				});
			};
		};


		/**
		 * Posts the release add form to the server.
		 */
		$scope.submit = function() {

			// add link if user has started typing something.
			if ($scope.newLink && ($scope.newLink.label || $scope.newLink.url)) {
				$scope.addLink($scope.newLink);
			}
			ReleaseResource.save($scope.release, function() {
				$scope.release.submitted = true;
				$scope.reset();

				ModalService.info({
					icon: 'check-circle',
					title: 'Release created!',
					subtitle: $scope.game.title,
					message: 'The release has been successfully created.'
				});

				// scroll to top
				$location.hash('top');
				$anchorScroll();

			}, ApiHelper.handleErrors($scope, function() {

				// scroll to bottom - timeout because at this point the dom isn't rendered with the new errors
//				$timeout(function() {
//					$location.hash('bottom');
//					$anchorScroll();
//				}, 500);

			}));
		};


		// either copy data from local storage or reset release data.
		if ($localStorage.release) {
			$scope.release = $localStorage.release;
			$scope.meta = $localStorage.release_meta;

			// update references
			_.each($scope.release.versions[0].files, function(file) {
				var metaFile = _.find($scope.meta.files, function(f) { return f.storage.id === file._file; });
				//metaFile.tableFile = file;
			});
			AuthService.collectUrlProps($scope.meta, true);

		} else {
			$scope.reset();
		}
	})


	.controller('ChooseAuthorCtrl', function($scope, $modalInstance, UserResource, release, meta, author) {

		if (author) {
			$scope.author = author;
			$scope.user = meta.users[author._user];
			$scope.roles = author.roles.slice();
			$scope.query = meta.users[author._user].name;
			$scope.isValidUser = true;
		} else {
			$scope.user = null;
			$scope.roles = [];
			$scope.isValidUser = false;
		}
		$scope.adding = author ? false : true;
		$scope.errors = {};
		$scope.release = release;
		$scope.role = '';

		$scope.findUser = function(val) {
			return UserResource.query({ q: val }).$promise;
		};

		$scope.userSelected = function(item, model) {
			$scope.user = model;
			$scope.isValidUser = true;
		};

		$scope.queryChange = function() {
			$scope.isValidUser = false;
		};

		$scope.addRole = function(role) {
			if (role && !~$scope.roles.indexOf(role)) {
				$scope.roles.push(role);
			}
			$scope.role = '';
		};

		$scope.removeRole = function(role) {
			$scope.roles.splice($scope.roles.indexOf(role), 1);
		};

		$scope.add = function() {
			$scope.addRole($scope.role);

			var valid = true;

			// user validations
			if (!$scope.isValidUser) {
				$scope.errors.user = 'You must select a user. Typing after selecting a user erases the selected user.';
				valid = false;
			} else if (_.filter($scope.release.authors, function(author) { return author._user === $scope.user.id; }).length > 0 &&
				($scope.adding || $scope.user.id !== $scope.author._user)) {
				$scope.errors.user = 'User "' + $scope.user.name + '" is already added as author.';
				valid = false;
			} else {
				delete $scope.errors.user;
			}

			// scope validations
			if ($scope.roles.length === 0) {
				$scope.errors.roles = 'Please add at least one role.';
				valid = false;
			} else if ($scope.roles.length > 3) {
				$scope.errors.roles = 'Three is the maxmimal number of roles an author can have. Please group roles if that\'s not enough.';
				valid = false;
			} else {
				delete $scope.errors.roles;
			}

			if (valid) {
				$modalInstance.close({ user: $scope.user, roles: $scope.roles });
			}
		};
	})


	.controller('CreateTagCtrl', function($scope, $modalInstance, ApiHelper, TagResource) {

		$scope.tag = {};
		$scope.create = function() {
			TagResource.save($scope.tag, function(tag) {
				$modalInstance.close(tag);

			}, ApiHelper.handleErrors($scope));
		};
	})


	.controller('AddBuildCtrl', function($scope, $modalInstance, $templateCache, ApiHelper, BuildResource) {

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
	})

	.filter('allowedFlavors', function() {
		return function(flavors, file) {
			if (file) {
				var ext = file.name.substr(file.name.lastIndexOf('.')).toLowerCase();
				if (ext !== '.vpx') {
					return _.omit(flavors, 'any');
				}
			}
			return flavors;
		};
	});