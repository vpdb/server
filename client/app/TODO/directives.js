"use strict"; /* global angular, Showdown, _ */


angular.module('vpdb.common', [])

	.directive('flipbox', function($timeout) {
		return {
			restrict: 'C',
			scope: true,
			controller: function($scope, $element) {

				$scope.active = false;

				$element.click(function() {
					if ($scope.active) {
						return;
					}
					$scope.active = true;
					$element.addClass('active');
					$scope.$apply();

					$timeout(function() {
						$scope.active = false;
						$element.removeClass('active');
						$element.toggleClass('reverse');
					}, 650, true);
				});
			}
		};
	})

	.directive('markdown', function($sanitize, $compile) {
		var converter = new Showdown.converter();
		return {
			restrict: 'AE',
			link: function(scope, element, attrs) {
				var linkUsers = function(html) {
					return html.replace(/@&#3[49];([^&]+)&#3[49];/g, '<user>$1</user>').replace(/@([^\s]+)/g, '<user>$1</user>');
				};
				if (attrs.markdown) {
					scope.$watch(attrs.markdown, function(newVal) {
						var html = newVal ? $sanitize(converter.makeHtml(newVal)) : '';
						element.html(linkUsers(html));
						$compile(element.contents())(scope);
					});
				} else {
					var mdText = element.text().replace(/^\s*[\n\r]+/g, '');
					var firstIdent = mdText.match(/^\s+/);
					mdText = ('\n' + mdText).replace(new RegExp('[\\n\\r]' + firstIdent, 'g'), '\n');
					var html = $sanitize(converter.makeHtml(mdText));
					element.html(linkUsers(html));
					$compile(element.contents())(scope);
				}
			}
		};
	})

	.directive('user', function($compile, $uibModal) {
		return {
			restrict: 'E',
			link: function(scope, element) {
				element.click(function() {
					$uibModal.open({
						templateUrl: '/users/modal-user-info.html',
						controller: 'UserDetailCtrl',
						resolve: {
							username: function() {
								return element.html();
							}
						}
					});
				});
			}
		};
	})


	.directive('markdownInfo', function(ModalService) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				var icon = '<svg class="svg-icon space-right shift-up"><use xlink:href="#icon-markdown"></use></svg>';
				element.html(icon + attrs.markdownInfo.replace(/markdown/gi, '<a href="#" ng-click="markdownInfo()">Markdown</a>'));
				element.find('a').click(function() {
					ModalService.markdown();
				});
			}
		};
	})

	.directive('filterRole', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				element.click(function() {
					element.toggleClass('active');
					scope.$emit('dataToggleRole', attrs.filterRole, element.hasClass('active'));
				});
			}
		};
	});
