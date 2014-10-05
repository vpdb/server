"use strict"; /* global _*/

angular.module('vpdb.users.list', [])

	.controller('AdminUserCtrl', function($scope, $modal, UserResource, RolesResource) {

		$scope.theme('light');
		$scope.setTitle('Users');
		$scope.setMenu('admin');
		$scope.users = UserResource.query();
		$scope.roles = RolesResource.query();

		$scope.filterRole = [];

		var firstLoad = true;

		$scope.edit = function(user) {
			$modal.open({
				templateUrl: 'users/modal-user-edit.html',
				controller: 'AdminUserEditCtrl',
				size: 'lg',
				resolve: {
					user: function () {
						return user;
					},
					roles: function () {
						return $scope.roles;
					}
				}
			});
		};

		var refresh = function() {
			var query = {};
			if (!firstLoad || $scope.query) {
				query.q = $scope.query;
				firstLoad = false;
			}
			if ($scope.filterRole.length > 0) {
				query.roles = $scope.filterRole.join(',');
			}

			$scope.users = UserResource.query(query);
		};

		$scope.$watch("query", $.debounce(350, function() {
			if (!firstLoad || $scope.query) {
				refresh();
			}
		}), true);

		$scope.$on('dataToggleRole', function(event, role) {
			if (_.contains($scope.filterRole, role)) {
				$scope.filterRole.splice($scope.filterRole.indexOf(role), 1);
			} else {
				$scope.filterRole.push(role);
			}
			$scope.$apply();
			refresh();
		});

	});

