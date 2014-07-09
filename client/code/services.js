'use strict';

/* Services */
var services = angular.module('vpdb.services', []);

services.factory('display', function() {
	return {
		media: function(type) {
			switch (type) {
				case 'backglass':
					return 'Backglass';
				case 'flyer':
					return 'Flyer';
				case 'instructioncard':
					return 'Instruction Card';
				default:
					return 'Unknown';
			}
		}
	}
});


app.factory('AuthService', function($window, $localStorage, $sessionStorage, ProfileResource) {
	return {

		user: null,
		isAuthenticated: false,

		init: function() {
			this.user = this.readUser();
			this.isAuthenticated = this.user ? true : false;
			this.permissions = this.user ? this.user.permissions : null;
			this.roles = this.user ? this.user.rolesAll : null;
		},

		/**
		 * Executed after successful API authentication using where we receive
		 * the user object along with the JWT.
		 *
		 * @param result Object with keys `token`, `expires` and `user`.
		 */
		authenticated: function(result) {

			// save token and user to storage
			$localStorage.user = result.user;
			this.readToken(result.token);

			// update data
			this.isAuthenticated = true;
			this.user = result.user;
			this.permissions = result.user.permissions;
			this.roles = result.user.rolesAll;
		},

		/**
		 * Executed after successful OAuth authentication using a callback URL
		 * where we only retrieve the token from the view and need to make
		 * further requests for user info.
		 *
		 * @param token JWT, as string
		 */
		tokenReceived: function(token) {

			this.readToken(token);
			this.user = $localStorage.user = ProfileResource.get();
		},

		logout: function() {
			this.user = null;
			this.isAuthenticated = false;
			delete this.permissions;
			delete this.roles;

			delete $localStorage.jwt;
			delete $localStorage.user;
			delete $localStorage.tokenExpires;
		},

		hasPermission: function(resourcePermission) {
			var p = resourcePermission.split('/');
			var resource = p[0];
			var permission = p[1];
			return this.permissions && _.contains(this.permissions[resource], permission);
		},

		hasRole: function(role) {
			if (_.isArray(role)) {
				for (var i = 0; i < role.length; i++) {
					if (this.roles && _.contains(this.roles, role[i])) {
						return true;
					}
				}
				return false;
			} else {
				return this.roles && _.contains(this.roles, role);
			}
		},

		readUser: function() {
			return $localStorage.user;
		},

		readToken: function(token) {
			var claims = angular.fromJson($window.atob(token.split('.')[1]));

			$localStorage.jwt = token;
			$localStorage.tokenExpires = new Date(claims.exp);
			$localStorage.tokenCreated = new Date(claims.iat);
			return claims.iss
		}
	};
});
