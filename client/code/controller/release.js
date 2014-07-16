
ctrl.controller('ReleaseAddCtrl', function($scope, $upload, $modal, $window, ApiHelper, IpdbResource, GameResource) {

	$scope.theme('light');
	$scope.setMenu('admin');

	$scope.onFilesUpload = function($files) {
		alert($files);
	}
});