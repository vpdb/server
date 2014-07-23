
ctrl.controller('ReleaseAddCtrl', function($scope, $upload, $modal, $window, AuthService, ApiHelper, FileResource, DisplayService) {

	$scope.theme('light');
	$scope.setMenu('admin');

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

	$scope.flavors = [
		{
			header: 'Orientation',
			name: 'orientation',
			values: [
				{ name: 'Desktop', other: 'Landscape', value: 'ws' },
				{ name: 'Landscape', other: 'Portrait', value: 'fs' }
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

	$scope.reset = function() {
		$scope.release = {
			authors: [
				{
					user: AuthService.getUser(),
					roles: [ 'Table Creator' ]
				}
			]
		};
	};

	$scope.remove = function(file) {
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
				return $modal.open({
					templateUrl: 'partials/modals/info',
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
					url: '/api/files',
					method: 'PUT',
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

	$scope.chooseAuthor = function() {
		$modal.open({
			templateUrl: 'partials/member/modals/choose-author',
			controller: 'ChooseAuthorCtrl',
			resolve: {
				release: function() { return $scope.release; }
			}
		}).result.then(function(author) {
			$scope.release.authors.push(author);
		});
	};


	$scope.reset();
});


ctrl.controller('ChooseAuthorCtrl', function($scope, $modalInstance, $http, UserResource) {

	$scope.user = null;
	$scope.roles = [];
	$scope.isValidUser = false;

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
		if (role) {
			$scope.roles.push(role);
		}
	};

	$scope.removeRole = function(role) {
		$scope.roles.splice($scope.roles.indexOf(role), 1);
	};

	$scope.add = function() {
		// TODO validations
		$modalInstance.close({ user: $scope.user, roles: $scope.roles });
	}
});
