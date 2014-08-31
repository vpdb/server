"use strict"; /* global ctrl, _ */

ctrl.controller('ReleaseAddCtrl', function($scope, $upload, $modal, $window, $localStorage, $routeParams,
                                           AuthService, ApiHelper,
                                           FileResource, TagResource, VPBuildResource, GameResource,
                                           DisplayService, MimeTypeService) {

	$scope.theme('light');
	$scope.setMenu('admin');
	$scope.setTitle('Add Release');

	$scope.files = [
		{
			name: 'Filename.vpt',
			bytes: 1337,
			icon: DisplayService.fileIcon('application/x-visual-pinball-table'),
			uploaded: true,
			uploading: false,
			progress: 100,
			storage: { id: 123 },
			flavor: {}
		},
		{
			name: 'Filename.jpg',
			bytes: 3321,
			icon: DisplayService.fileIcon('image/jpeg'),
			uploaded: true,
			uploading: false,
			progress: 100,
			storage: { id: 123 },
			flavor: {}
		}
	];

	$scope.tags = TagResource.query();

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

	$scope.game = GameResource.get({ id: $routeParams.id }, function() {
		$scope.game.lastrelease = new Date($scope.game.lastrelease).getTime();
		$scope.setTitle('Add Release - ' + $scope.game.title);
	});

	$scope.mediaFile = {};
	$scope.reset = function() {

		$scope.mediaFile = {};
		$scope.release = $localStorage.release = {
			authors: [{ user: AuthService.getUser(), roles: [ 'Table Creator' ]}],
			tags: [],
			links: [],
			vpbuilds: {
				developed: [],
				tested: [],
				incompat: []
			},
			_media: {},

			mediaFile: {
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
			}
		};
	};


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

	$scope.removeFile = function(file) {
		FileResource.delete({ id: file.storage.id }, function() {
			$scope.files.splice($scope.files.indexOf(file), 1);

		}, ApiHelper.handleErrorsInDialog($scope, 'Error removing file.'));
	};

	$scope.onFilesUpload = function($files) {

		// 1. validate file types
		for (var i = 0; i < $files.length; i++) {
			var file = $files[i];
			var ext = file.name.substr(file.name.lastIndexOf('.') + 1, file.name.length);

			if (!_.contains(['image/jpeg', 'image/png'], file.type) && !_.contains(['vpt', 'vpx', 'vbs'], ext)) {
				//noinspection JSHint
				return $modal.open({
					templateUrl: 'partials/modals/info.html',
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
				var key = upload.name; // TODO use another id, such as a hash or whatever so we can upload files with the same filename.
				var ext = upload.name.substr(upload.name.lastIndexOf('.') + 1, upload.name.length);
				var type = upload.type;
				if (!type) {
					switch (ext) {
						case 'vpt':
							type = 'application/x-visual-pinball-table';
							break;
						case 'vpx':
							type = 'application/x-visual-pinball-table-x';
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
					flavor: {}
				};
				$scope.files.push(file);
				$upload.http({
					url: '/storage',
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
				}, ApiHelper.handleErrorsInDialog($scope, 'Error uploading file.', function() {
					$scope.files.splice($scope.files.indexOf(file), 1);
				}), function (evt) {
					file.progress = parseInt(100.0 * evt.loaded / evt.total);
				});
			};
		});
	};

	$scope.addAuthor = function(author) {
		$modal.open({
			templateUrl: 'partials/member/modals/author-add.html',
			controller: 'ChooseAuthorCtrl',
			resolve: {
				release: function() { return $scope.release; },
				author: function() { return author; }
			}
		}).result.then(function(newAuthor) {
			if (author) {
				$scope.release.authors[$scope.release.authors.indexOf(author)] = newAuthor;
			} else {
				$scope.release.authors.push(newAuthor);
			}

		});
	};

	$scope.removeAuthor = function(author) {
		$scope.release.authors.splice($scope.release.authors.indexOf(author), 1);
	};


	$scope.createTag = function() {
		$modal.open({
			templateUrl: 'partials/member/modals/tag-create.html',
			controller: 'CreateTagCtrl'
		}).result.then(function(newTag) {
			$scope.tags.push(newTag);
		});
	};


	$scope.removeTag = function(tag) {
		$scope.release.tags.splice($scope.release.tags.indexOf(tag), 1);
		$scope.tags.push(tag);
	};


	$scope.addLink = function(link) {
		$scope.release.links.push(link);
		return {};
	};

	$scope.removeLink = function(link) {
		$scope.release.links.splice($scope.release.links.indexOf(link), 1);
	};


	$scope.addVPBuild = function() {
		$modal.open({
			templateUrl: 'partials/member/modals/vpbuild-create.html',
			controller: 'AddVPBuildCtrl',
			size: 'lg'
		}).result.then(function(newTag) {
			$scope.tags.push(newTag);
		});
	};


	$scope.onMediaUpload = function(id, $files) {

		var file = $files[0];
		var mimeType = MimeTypeService.fromFile(file);

		$scope.mediaFile[id] = {};

		if ($scope.release.mediaFile[id] && $scope.release.mediaFile[id].id) {
			FileResource.delete({ id : $scope.release.mediaFile[id].id });

			$scope.release.mediaFile[id] = {
				url: false,
				variations: {
					'medium-2x': { url: false }
				}
			};
			this.$emit('imageUnloaded');
		}

		// upload image
		var fileReader = new FileReader();
		fileReader.readAsArrayBuffer(file);
		fileReader.onload = function(event) {

			$scope.release.mediaFile[id] = { url: false };
			$scope.mediaFile[id].uploaded = false;
			$scope.mediaFile[id].uploading = true;
			$scope.mediaFile[id].status = 'Uploading file...';
			$upload.http({
				url: '/storage',
				method: 'POST',
				params: { type: 'playfield' },
				headers: {
					'Content-Type': mimeType,
					'Content-Disposition': 'attachment; filename="' + file.name + '"'
				},
				data: event.target.result
			}).then(function(response) {
				$scope.mediaFile[id].uploading = false;
				$scope.mediaFile[id].status = 'Uploaded';

				var mediaResult = response.data;
				$scope.release.mediaFile[id].id = mediaResult.id;
				$scope.release.mediaFile[id].url = AuthService.setUrlParam(mediaResult.url, mediaResult.is_protected);
				$scope.release.mediaFile[id].variations = AuthService.setUrlParam(mediaResult.variations, mediaResult.is_protected);
				$scope.release.mediaFile[id].metadata = mediaResult.metadata;

			}, ApiHelper.handleErrorsInDialog($scope, 'Error uploading image.', function() {
				$scope.mediaFile[id] = {};

			}), function (evt) {
				$scope.mediaFile[id].progress = parseInt(100.0 * evt.loaded / evt.total);
			});
		};
	};

	if ($localStorage.release) {
		$scope.release  = $localStorage.release;
	} else {
		$scope.reset();
	}
});


ctrl.controller('ChooseAuthorCtrl', function($scope, $modalInstance, UserResource, release, author) {

	if (author) {
		$scope.author = author;
		$scope.user = author.user;
		$scope.roles = author.roles.slice();
		$scope.query = author.user.name;
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
		if (!$scope.isValidUser) {
			$scope.errors.user = 'You must select a user. Typing after selecting a user erases the selected user.';
			valid = false;
		} else if (_.filter($scope.release.authors, function(author) { return author.user.id === $scope.user.id; }).length > 0 &&
		          ($scope.adding || $scope.user.id !== $scope.author.user.id)) {
			$scope.errors.user = 'User "' + $scope.user.name + '" is already added as author.';
			valid = false;
		} else {
			delete $scope.errors.user;
		}

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
});


ctrl.controller('CreateTagCtrl', function($scope, $modalInstance, ApiHelper, TagResource) {

	$scope.tag = {};
	$scope.create = function() {
		TagResource.save($scope.tag, function(tag) {
			$modalInstance.close(tag);

		}, ApiHelper.handleErrors($scope));
	};
});


ctrl.controller('AddVPBuildCtrl', function($scope, $modalInstance, ApiHelper, VPBuildResource) {

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