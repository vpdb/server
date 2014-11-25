"use strict"; /* global common, videojs, _ */

common

	.directive('videojs', function($parse, $http, $timeout, AuthService) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {

				attrs.type = attrs.type || "video/mp4";

				var setup = {
					techOrder: ['html5', 'flash'],
					controls: true,
					preload: 'metadata',
					autoplay: false,
					loop: true
				};

				var videoid = Math.round(Math.random() * 1000000);
				attrs.id = "videojs" + videoid;
				element.attr('id', attrs.id);

				var player = null;
				attrs.$observe('videoSrc', function(value) {

					// todo this is ugly. find out why we have a string here instead of an object.
					if (value[0] === '{') {
						value = $parse(value)();
					}
					var url = _.isObject(value) ? value.url : value;
					var isProtected = _.isObject(value) ? value.is_protected : false;

					console.log('src changed to "%s", player = %s', url, player);
					if (url) {

						var timeout = $timeout(function() {
							scope.videoLoading = true;
						}, 1000);


						var waitAndSetUrl = function(url) {
							element.attr('source', url);
							$http({ method: 'HEAD', url: url }).success(function() {
//								console.log(new Date() + ' Back from HEAD, id = %s', attrs.id);
								var src = { type: 'video/mp4', src: url };
								if (!player) {
									player = videojs(attrs.id, setup, function() {
										this.src(src);
									});
								} else {
									player.src(src);
								}

								$timeout.cancel(timeout);
								scope.videoLoading = false;
								scope.$emit('videoLoaded');

							}).error(function(data, status) {
								console.error('Error fetching HEAD of uploaded video: ' + status);
								console.error(data);
							});
						};

						if (!isProtected) {
							waitAndSetUrl(url);
						} else {
							AuthService.addUrlToken(url, waitAndSetUrl);
						}

					}

					if (!value && player) {
						scope.$emit('videoUnloaded');
					}
				});

				scope.$on('$destroy', function() {
					if (player) {
						player.dispose();
						player = null;
					}
				});
			}
		};
	});

