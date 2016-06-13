"use strict"; /* global _ */

angular.module('vpdb.backglasses.add', [])

	.controller('AddBackglassCtrl', function($scope, $stateParams, $localStorage, AuthService,
											 GameResource, FileResource) {

		$scope.theme('light');
		$scope.setTitle('Add Backglass');

		// fetch game info
		$scope.game = GameResource.get({ id: $stateParams.id }, function() {
			$scope.backglass._game = $scope.game.id;
			$scope.setTitle('Add Backglass - ' + $scope.game.title);
		});

		/**
		 * Resets all entered data
		 */
		$scope.reset = function() {

			// delete media if already uploaded
			if ($scope.backglass && !$scope.backglass.submitted) {
				if ($scope.meta.files && $scope.meta.files.backglass && $scope.meta.files.backglass.id) {
					FileResource.delete({ id: $scope.meta.files.backglass.id });
				}
			}

			var currentUser = AuthService.getUser();

			/*
			 * `meta` is all the data we need for displaying the page but that
			 * is not part of the backglass object posted to the API.
			 */
			if (!$localStorage.backglass_meta) {
				$localStorage.backglass_meta = {};
			}
			$scope.meta = $localStorage.backglass_meta[$stateParams.id] = {
				users: {},
				files: {}
			};
			$scope.meta.users[currentUser.id] = currentUser;
			$scope.meta.releaseDate = new Date();

			/*
			 * `backglass` is the object posted to the API.
			 */
			if (!$localStorage.backglass || $localStorage.backglass._game) {
				$localStorage.backglass = {};
			}
			$scope.backglass = $localStorage.backglass[$stateParams.id] = {
				_game: $stateParams.id,
				description: '',
				versions: [ {
					version: '',
					changes: '*Initial release.*',
					file: null
				} ],
				authors: [ {
					_user: currentUser.id,
					roles: [ 'Creator' ]
				} ],
				acknowledgements: ''
			};
			$scope.errors = {};
		};

		$scope.onBackglassUpload = function(status) {

			var bg = status.storage;
			AuthService.collectUrlProps(bg, true);
			$scope.backglass._file = bg.id;
			$scope.meta.files.backglass = bg;
		};

		// init data: either copy from local storage or reset.
		if ($localStorage.backglass && $localStorage.backglass[$stateParams.id] && $localStorage.backglass[$stateParams.id].versions) {
			$scope.backglass = $localStorage.backglass[$stateParams.id];
			$scope.meta = $localStorage.backglass_meta[$stateParams.id];

			AuthService.collectUrlProps($scope.meta, true);

		} else {
			$scope.reset();
		}
	});