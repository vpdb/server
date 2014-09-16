"use strict"; /* global directives */

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
directives.directive('makeLoaded', function($timeout, $parse) {
	return {
		scope: true,
		restrict: 'A',
		link: function (scope, element, attrs) {
			var postVar;
			if (attrs.makeLoadedPost) {
				postVar = $parse(attrs.makeLoadedPost);
				postVar.assign(scope, false);
			}
			var eventPrefix = attrs.makeLoadedEvent || 'image';
			scope.$on(eventPrefix + 'Loaded', function(event) {
				event.stopPropagation();
				element.addClass(attrs.makeLoaded);
				if (postVar) {
					$timeout(function() {
						postVar.assign(scope, true);
					}, 350);
				}
			});
			scope.$on(eventPrefix + 'Unloaded', function(event) {
				event.stopPropagation();
				element.removeClass(attrs.makeLoaded);
				if (postVar) {
					postVar.assign(scope, false);
				}
			});
		}
	};
});

directives.directive('imgBg', function($parse) {
	return {
		scope: true,
		restrict: 'A',
		link: function(scope, element, attrs) {

			scope.img = { url: false, loading: false };
			var setImg = function(value) {

				// check for empty
				if (value === false) {
					scope.img = { url: false, loading: false };
					element.css('background-image', 'none');
					//element.removeClass('loaded');
					scope.$emit('imageUnloaded');

				} else {
					scope.img = { url: value, loading: true };
					element.css('background-image', "url('" + value + "')");
					element.waitForImages({
						each: function() {
							var that = $(this);
							that.addClass('loaded');
							scope.$emit('imageLoaded');
							scope.img.loading = false;
							//scope.$apply();
						},
						waitForAll: true
					});
				}
			};

			// check for constant
			if (attrs.imgBg.substr(0, 1) === '/') {
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
});

directives.directive('imgSrc', function() {
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