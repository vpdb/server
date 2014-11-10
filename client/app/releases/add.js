"use strict"; /* global _ */

angular.module('vpdb.releases.add', [])


	/**
	 * Main controller containing the form for adding a new release.
	 */
	.controller('ReleaseAddCtrl', function($scope, $upload, $modal, $window, $localStorage, $routeParams,
										   $location, $anchorScroll, $timeout,
										   AuthService, ApiHelper,
										   ReleaseResource, FileResource, TagResource, VPBuildResource, GameResource,
										   ConfigService, DisplayService, MimeTypeService) {

		$scope.theme('light');
		$scope.setMenu('admin');
		$scope.setTitle('Add Release');

//		$scope.meta.files = [
//			{
//				name: 'Filename.vpt',
//				bytes: 1337,
//				icon: DisplayService.fileIcon('application/x-visual-pinball-table'),
//				uploaded: true,
//				uploading: false,
//				progress: 100,
//				storage: { id: 'abcd' },
//				flavor: {}
//			},
//			{
//				name: 'Anotherfile.vpx',
//				bytes: 12213,
//				icon: DisplayService.fileIcon('application/x-visual-pinball-table-x'),
//				uploaded: true,
//				uploading: false,
//				progress: 100,
//				storage: { id: 'asdf' },
//				flavor: {}
//			},
//			{
//				name: 'Filename.jpg',
//				bytes: 3321,
//				icon: DisplayService.fileIcon('image/jpeg'),
//				uploaded: true,
//				uploading: false,
//				progress: 100,
//				storage: { id: '1234' },
//				flavor: {}
//			}
//		];

		// define flavors
		$scope.flavors = [
			{
				header: 'Orientation',
				name: 'orientation',
				values: [
					{ name: 'Desktop', other: 'Landscape', value: 'ws' },
					{ name: 'Cabinet', other: 'Portrait', value: 'fs' }
				]
			}, {
				header: 'Lightning',
				name: 'lightning',
				values: [
					{ name: 'Night', other: 'Dark Playfield', value: 'night' },
					{ name: 'Day', other: 'Illuminated Playfield', value: 'day' }
				]
			}
		];

		// fetch game info
		$scope.game = GameResource.get({ id: $routeParams.id }, function() {
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
		var vpbuilds = VPBuildResource.query(function() {
			$scope.builds = {};
			var types = [];
			_.each(vpbuilds, function(vpbuild) {
				if (!$scope.builds[vpbuild.type]) {
					$scope.builds[vpbuild.type] = [];
					types.push(vpbuild.type);
				}
				vpbuild.built_at = new Date(vpbuild.built_at);
				$scope.builds[vpbuild.type].push(vpbuild);
			});
			_.each(types, function(type) {
				$scope.builds[type].sort(function(a, b) {
					return a.built_at.getTime() === b.built_at.getTime() ? 0 : (a.built_at.getTime() > b.built_at.getTime() ? -1 : 1);
				});
			});
		});


		/**
		 * Copies ids from media files into the release object
		 * @param {array} mediaFiles
		 * @param {object} release
		 */
		var updateMedia = function(mediaFiles, release) {
			_.each(mediaFiles, function(mediaFile, fileId) {
				var file = _.find(release.versions[0].files, { _file: fileId });
				file._media = {};
				_.each(mediaFile, function(f, type) {
					file._media[type] = f.id;
				});
			});
		};


		/**
		 * Resets all entered data
		 */
		$scope.reset = function() {

			var currentUser = AuthService.getUser();

			var emptyMedia = {
				playfieldImage: {
					url: false,
					variations: {
						'medium-2x': { url: false }
					}
				},
				playfieldVideo: {
					url: false,
					variations: {
						'still': { url: false },
						'small-rotated': { url: undefined }
					}
				}
			};

			/*
			 * `meta` is all the data we need for displaying the page but that
			 * is not part of the release object.
			 */
			$scope.meta = $localStorage.release_meta = {
				users: {},     // serves only for displaying purposes. key: id, value: full object
				files: [],     // that's the "driving" object, i.e. stuff gets pulled from this and also the view loops over it.
				tags: [],      // also driving object. on drop and remove, ids get copied into release object from here.
				mediaFiles: {} // also driving object.
			};
			$scope.meta.users[currentUser.id] = currentUser;

			$scope.release = $localStorage.release = {
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
		 * When file(s) are dropped to the upload drop zone
		 * @param {array} $files
		 */
		$scope.onFilesUpload = function($files) {

			// 1. validate file types
			for (var i = 0; i < $files.length; i++) {
				var file = $files[i];
				var ext = file.name.substr(file.name.lastIndexOf('.') + 1, file.name.length);

				if (!_.contains(['image/jpeg', 'image/png'], file.type) && !_.contains(['vpt', 'vpx', 'vbs'], ext)) {
					//noinspection JSHint
					return $modal.open({
						templateUrl: 'common/modal-info.html',
						controller: 'InfoModalCtrl',
						resolve: {
							icon: function() { return 'fa-file-image-o'; },
							title: function() { return 'Image Upload'; },
							subtitle: function() { return 'Wrong file type!'; },
							message: function() { return 'Please upload a valid file type (more info to come).'; }
						}
					});
				}
			}

			// 2. upload files
			_.each($files, function(upload) {
				var fileReader = new FileReader();
				fileReader.readAsArrayBuffer(upload);
				fileReader.onload = function(event) {
					var ext = upload.name.substr(upload.name.lastIndexOf('.') + 1, upload.name.length);
					var type = upload.type;
					var isTable = false;
					if (!type) {
						switch (ext) {
							case 'vpt':
								type = 'application/x-visual-pinball-table';
								isTable = true;
								break;
							case 'vpx':
								type = 'application/x-visual-pinball-table-x';
								isTable = true;
								break;
							case 'vbs':
								type = 'application/vbscript';
								break;
						}
					}
					var file = {
						name: upload.name,
						bytes: upload.size,
						icon: DisplayService.fileIcon(type),
						uploaded: false,
						uploading: true,
						progress: 0,
						flavor: {},
						vpbuilds: []
					};
					$scope.meta.files.push(file);
					$upload.http({
						url: ConfigService.storageUri(),
						method: 'POST',
						params: { type: 'release' },
						headers: {
							'Content-Type': type,
							'Content-Disposition': 'attachment; filename="' + upload.name + '"'
						},
						data: event.target.result
					}).then(function(response) {
						file.uploading = false;
						file.storage = response.data;
						if (!isTable) {
							$scope.release.versions[0].files.push({ _file: response.data.id });
						} else {
							$scope.release.versions[0].files.push({
								_file: response.data.id,
								flavor: file.flavor,
								_compatibility: file.vpbuilds,
								_media: {
									playfield_image: null,
									playfield_video: null
								}
							});
						}

					}, ApiHelper.handleErrorsInDialog($scope, 'Error uploading file.', function() {
						$scope.meta.files.splice($scope.meta.files.indexOf(file), 1);
					}), function (evt) {
						file.progress = parseInt(100.0 * evt.loaded / evt.total);
					});
				};
			});
		};


		/**
		 * Adds OR edits an author.
		 * @param {object} author If set, edit this author, otherwise add a new one.
		 */
		$scope.addAuthor = function(author) {
			$modal.open({
				templateUrl: 'releases/modal-author-add.html',
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
				templateUrl: 'releases/modal-tag-create.html',
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
		 * Adds or removes a VP build to/from to a given file of the release
		 * @param {object} file
		 * @param {object} vpbuild
		 */
		$scope.toggleVPBuild = function(file, vpbuild) {
			var idx = file.vpbuilds.indexOf(vpbuild.id);
			if (idx > -1) {
				file.vpbuilds.splice(idx, 1);
			} else {
				file.vpbuilds.push(vpbuild.id);
			}
		};

		/**
		 * Opens the dialog for creating a new VP build.
		 */
		$scope.addVPBuild = function() {
			$modal.open({
				templateUrl: 'releases/modal-vpbuild-create.html',
				controller: 'AddVPBuildCtrl',
				size: 'lg'
			}).result.then(function(newBuild) {
				// todo
			});
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
		 * @param {string} tableFileId Storage ID of the uploaded vpt
		 * @param {string} type Media type, e.g. "playfieldImage" or "playfieldVideo"
		 * @param {array} $files Uploaded file(s), assuming that one was chosen.
		 */
		$scope.onMediaUpload = function(tableFileId, type, $files) {

			var file = $files[0];
			var mimeType = MimeTypeService.fromFile(file);

			// init
			_.defaults($scope, { mediaFiles: {}});
			if (!$scope.mediaFiles[tableFileId]) {
				$scope.mediaFiles[tableFileId] = {};
			}
			$scope.mediaFiles[tableFileId][type] = {};
			if (!$scope.meta.mediaFiles[tableFileId]) {
				$scope.meta.mediaFiles[tableFileId] = {};
			}

			if ($scope.meta.mediaFiles[tableFileId][type] && $scope.meta.mediaFiles[tableFileId][type].id) {
				FileResource.delete({ id : $scope.meta.mediaFiles[tableFileId][type].id });

				$scope.meta.mediaFiles[tableFileId][type] = {
					url: false,
					variations: {
						'medium-2x': { url: false },
						'still': { url: false }
					}
				};
				this.$emit('imageUnloaded');
			}

			// upload image
			var fileReader = new FileReader();
			fileReader.readAsArrayBuffer(file);
			fileReader.onload = function(event) {

				$scope.meta.mediaFiles[tableFileId][type] = { url: false };
				$scope.mediaFiles[tableFileId][type].uploaded = false;
				$scope.mediaFiles[tableFileId][type].uploading = true;
				$scope.mediaFiles[tableFileId][type].status = 'Uploading file...';
				$upload.http({
					url: ConfigService.storageUri(),
					method: 'POST',
					params: { type: 'playfield' },
					headers: {
						'Content-Type': mimeType,
						'Content-Disposition': 'attachment; filename="' + file.name + '"'
					},
					data: event.target.result
				}).then(function(response) {
					$scope.mediaFiles[tableFileId][type].uploading = false;
					$scope.mediaFiles[tableFileId][type].status = 'Uploaded';

					var mediaResult = response.data;
					$scope.meta.mediaFiles[tableFileId][type].id = mediaResult.id;
					$scope.meta.mediaFiles[tableFileId][type].url = AuthService.setUrlParam(mediaResult.url, mediaResult.is_protected);
					$scope.meta.mediaFiles[tableFileId][type].variations = AuthService.setUrlParam(mediaResult.variations, mediaResult.is_protected);
					$scope.meta.mediaFiles[tableFileId][type].metadata = mediaResult.metadata;
					updateMedia($scope.meta.mediaFiles, $scope.release);

				}, ApiHelper.handleErrorsInDialog($scope, 'Error uploading image.', function() {
					$scope.mediaFiles[tableFileId][type] = {};

				}), function (evt) {
					$scope.mediaFiles[tableFileId][type].progress = parseInt(100.0 * evt.loaded / evt.total);
				});
			};
		};


		/**
		 * Posts the release add form to the server.
		 */
		$scope.submit = function() {
			ReleaseResource.save($scope.release, function(){
				$scope.release.submitted = true;
				$scope.reset();
				$modal.open({
					templateUrl: 'common/modal-info.html',
					controller: 'InfoModalCtrl',
					resolve: {
						icon: function() { return 'fa-check-circle-o'; },
						title: function() { return 'Release Created!'; },
						subtitle: function() { return $scope.game.title; },
						message: function() { return 'The release has been successfully created.'; }
					}
				});

				// scroll to top
				$location.hash('top');
				$anchorScroll();

			}, ApiHelper.handleErrors($scope, function() {

				// scroll to bottom - timeout because at this point the dom isn't rendered with the new errors
				$timeout(function() {
					$location.hash('bottom');
					$anchorScroll();
				}, 500);

			}));
		};


		// either copy data from local storage or reset release data.
		if ($localStorage.release) {
			$scope.release = $localStorage.release;
			$scope.meta = $localStorage.release_meta;

			// update references
			_.each($scope.release.versions[0].files, function(file) {
				var metaFile = _.find($scope.meta.files, function(f) { return f.storage.id === file._file; });
				file._compatibility = metaFile.vpbuilds;
				file.flavor = metaFile.flavor;
			});

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


	.controller('AddVPBuildCtrl', function($scope, $modalInstance, ApiHelper, VPBuildResource) {

		$scope.vpbuild = {};
		$scope.showWeeks = false;

		$scope.openCalendar = function($event) {
			$event.preventDefault();
			$event.stopPropagation();

			$scope.calendarOpened = true;
		};

		$scope.add = function() {
			VPBuildResource.save($scope.tag, function(tag) {
				$modalInstance.close(tag);

			}, ApiHelper.handleErrors($scope));
		};
	});