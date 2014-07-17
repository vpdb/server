
ctrl.controller('ReleaseAddCtrl', function($scope, $upload, $modal, $window, ApiHelper, IpdbResource, GameResource) {

	$scope.theme('light');
	$scope.setMenu('admin');


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
		alert($files);
	};
});