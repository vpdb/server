
ctrl.controller('ReleaseAddCtrl', function($scope, $upload, $modal, $window, ApiHelper, FileResource, DisplayService) {

	$scope.theme('light');
	$scope.setMenu('admin');

	$scope.files = [
//		{
//			name: 'Filename',
//			bytes: 1337,
//			icon: DisplayService.fileIcon(),
//			uploaded: true,
//			uploading: false,
//			progress: 100,
//			storage: { _id: 123 }
//		}
	];

	$scope.remove = function(file) {
		FileResource.delete({ id: file.storage._id }, function() {
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
					progress: 0
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
				}, ApiHelper.handleErrorsInDialog($scope, 'Error uploading file.'), function (evt) {
					file.progress = parseInt(100.0 * evt.loaded / evt.total);
				});
			};
		});
	};
});