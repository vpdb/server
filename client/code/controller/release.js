
ctrl.controller('ReleaseAddCtrl', function($scope, $upload, $modal, $window, ApiHelper, IpdbResource, GameResource) {

	$scope.theme('light');
	$scope.setMenu('admin');

	$scope.fileStatus = {
		uploaded: {},
		uploading: {},
		progress: {}
	}

	$scope.files = [
		{
			name: 'Monster Bash(Williams) (1998) (uw randr) (2.6) (FS).vpt',
			bytes: 60301235,
			icon: 'vpt'
		},
		{
			name: 'needed_script.vbs',
			bytes: 11354,
			icon: 'code'
		}
	];

	$scope.onFilesUpload = function($files) {

		// 1. validate file types
		for (var i = 0; i < $files.length; i++) {
			var file = $files[i];
			var ext = file.name.substr(file.name.indexOf('.') + 1, file.name.length);

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
		_.each($files, function(file) {
			var fileReader = new FileReader();
			fileReader.readAsArrayBuffer(file);
			fileReader.onload = function(event) {
				var key = file.name; // TODO use another id, such as a hash or whatever so we can upload files with the same filename.
				var ext = file.name.substr(file.name.indexOf('.') + 1, file.name.length);
				var type = file.type;
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
				$scope.fileStatus.uploaded[key] = false;
				$scope.fileStatus.uploading[key] = true;
				$scope.fileStatus.progress[key] = 0;
				console.log(file);
				console.log('uploading %s..', file.name);
				$upload.http({
					url: '/api/files',
					method: 'PUT',
					params: { type: 'release' },
					headers: {
						'Content-Type': type,
						'Content-Disposition': 'attachment; filename="' + file.name + '"'
					},
					data: event.target.result
				}).then(function(response) {
					$scope.fileStatus.uploading[key]  = false;
					done(response);
				}, ApiHelper.handleErrorsInDialog($scope, 'Error uploading file.'), function (evt) {
					$scope.fileStatus.progress[key] = parseInt(100.0 * evt.loaded / evt.total);
				});
			};
		});
	};
});