"use strict"; /* global _ */

angular.module('vpdb.backglasses.add', [])

	.controller('AddBackglassCtrl', function($scope, $stateParams, $localStorage, $state, $uibModal,
											 AuthService, ApiHelper, ModalService,
											 GameResource, FileResource, BackglassResource) {
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
				files: { backglass: { variations: { full: false } } }
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
					_file: null
				} ],
				authors: [ {
					_user: currentUser.id,
					roles: [ 'Creator' ]
				} ],
				acknowledgements: ''
			};
			$scope.errors = {};
		};

		/**
		 * Posts the backglass entity to the API.
		 */
		$scope.submit = function() {

			// update release date if set
			var releaseDate = $scope.getReleaseDate();
			if (releaseDate) {
				$scope.backglass.versions[0].released_at = releaseDate;
			} else {
				delete $scope.backglass.versions[0].released_at;
			}

			// post to api
			BackglassResource.save($scope.backglass, function(backglass) {
				$scope.backglass.submitted = true;
				$scope.reset();

				ModalService.info({
					icon: 'check-circle',
					title: 'Backglass created!',
					subtitle: $scope.game.title,
					message: 'The backglass has been successfully created.'
				});

				// go to game page
				$state.go('gameDetails', { id: $stateParams.id });

			}, ApiHelper.handleErrors($scope));
		};

		/**
		 * A .directb2s file has been uploaded.
		 * @param status File status
		 */
		$scope.onBackglassUpload = function(status) {

			var bg = status.storage;
			AuthService.collectUrlProps(bg, true);
			$scope.backglass.versions[0]._file = bg.id;
			$scope.meta.files.backglass = bg;
			$scope.meta.files.backglass.storage = { id: bg.id }; // so file-upload deletes old file when new one gets dragged over
		};

		/**
		 * Adds OR edits an author.
		 * @param {object} author If set, edit this author, otherwise add a new one.
		 */
		$scope.addAuthor = function(author) {
			$uibModal.open({
				templateUrl: '/common/modal-author-choose.html',
				controller: 'ChooseAuthorCtrl',
				resolve: {
					subject: function() { return $scope.backglass; },
					meta: function() { return $scope.meta; },
					author: function() { return author; }
				}
			}).result.then(function(newAuthor) {

				// here we're getting the full object, so store the user object in meta.
				var authorRef = { _user: newAuthor.user.id, roles: newAuthor.roles };
				$scope.meta.users[newAuthor.user.id] = newAuthor.user;

				// add or edit?
				if (author) {
					$scope.backglass.authors[$scope.release.authors.indexOf(author)] = authorRef;
				} else {
					$scope.backglass.authors.push(authorRef);
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
		 * Returns a date object from the date and time picker.
		 * If empty, returns null.
		 */
		$scope.getReleaseDate = function() {
			if ($scope.meta.releaseDate || $scope.meta.releaseTime) {
				var date = $scope.meta.releaseDate ? new Date($scope.meta.releaseDate) : new Date();
				var time = $scope.meta.releaseTime ? new Date($scope.meta.releaseTime) : new Date();
				return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.getHours(), time.getMinutes());
			}
			return null;
		};


		// CONTROLLER LOGIC START
		// --------------------------------------------------------------------

		// init data: either copy from local storage or reset.
		if ($localStorage.backglass && $localStorage.backglass[$stateParams.id] && $localStorage.backglass[$stateParams.id].versions) {
			$scope.backglass = $localStorage.backglass[$stateParams.id];
			$scope.meta = $localStorage.backglass_meta[$stateParams.id];

			AuthService.collectUrlProps($scope.meta, true);

		} else {
			$scope.reset();
		}
	});