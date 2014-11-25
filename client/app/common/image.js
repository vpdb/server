"use strict"; /* global common, _ */

/**
 * Updates scope on child events.
 *
 * The goal of this directive is to add/remove a class and set/unset a scope
 * variable depending on a child's emitted events. Concretely, we have:
 *
 * 	- `make-loaded`: The class that is added removed to the DOM
 * 	- `make-loaded-post`: The scope variable that is set to true or false
 * 	- `make-loaded-event`: The event prefix that enables/disables the class and variable.
 *
 * For example, if we have `<div make-loaded="loaded" make-loaded-event="image" make-loaded-post="loadingFinished"/>`,
 * that means if a `imageLoaded` event is received, the `<div>` gets the
 * `loaded` class added and the `loadingFinished` scope variable is set to true.
 * The `imageUnloaded` event would then remove the class and set
 * `loadingFinished` to  `false`.
 */
common
	.directive('makeLoaded', function($timeout, $parse) {
		return {
			scope: true,
			restrict: 'A',
			link: function (scope, element, attrs) {
				var postVar;
				var filter = {};
				scope.$watch(attrs.makeLoaded, function() {
					filter = scope.$eval(attrs.makeLoaded);
				}, true);

				if (attrs.makeLoadedPost) {
					postVar = $parse(attrs.makeLoadedPost);
					postVar.assign(scope, false);
				}
				var eventPrefix = attrs.makeLoadedEvent || 'image';
				scope.$on(eventPrefix + 'Loaded', function(event) {
					event.stopPropagation();
					_.each(filter, function(enabled, className) {
						if (!enabled) {
							return;
						}
						element.addClass(className);
						if (postVar) {
							$timeout(function() {
								postVar.assign(scope, true);
							}, 350);
						}
					});
				});
				scope.$on(eventPrefix + 'Unloaded', function(event) {
					event.stopPropagation();
					_.each(filter, function(enabled, className) {
						element.removeClass(className);
						if (postVar) {
							postVar.assign(scope, false);
						}
					});

				});
			}
		};
	})

	.directive('imgBg', function($parse, AuthService) {
		return {
			scope: true,
			restrict: 'A',
			link: function(scope, element, attrs) {

				scope.img = { url: false, loading: false };
				var setImg = function(value) {

					var url = _.isObject(value) ? value.url : value;
					var isProtected = _.isObject(value) ? value.is_protected : false;

					// check for empty
					if (url === false) {
						scope.img = { url: false, loading: false };
						element.css('background-image', 'none');
						//element.removeClass('loaded');
						scope.$emit('imageUnloaded');

					} else {
						if (!isProtected) {
							setImgUrl(url);
						} else {
							AuthService.addUrlToken(url, setImgUrl);
						}
					}
				};

				var setImgUrl = function(url) {
					scope.img = { url: url, loading: true };
					element.css('background-image', "url('" + url + "')");
					element.waitForImages({
						each: function() {
							var that = $(this);
							that.addClass('loaded');
							scope.$emit('imageLoaded');
							scope.img.loading = false;
							scope.$apply();
						},
						waitForAll: true
					});
				};

				// check for constant
				if (attrs.imgBg[0] === '/') {
					setImg(attrs.imgBg);

				// otherwise, watch scope for expression.
				} else {
					var value = $parse(attrs.imgBg);
					scope.$watch(value, function() {
						var v = value(scope);
						if (v || v === false) {
							setImg(v);
						}
					});
				}
			}
		};
	})

	.directive('imgSrc', function() {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {
				attrs.$observe('imgSrc', function(value) {
					element.attr('src', value);
					element.waitForImages(function() {
						$(this).addClass('loaded');
					}, function() {
						console.error('wait has failed.');
					});
				});
			}
		};
	});