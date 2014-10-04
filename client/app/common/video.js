"use strict"; /* global app, videojs */

app
	.directive('videojs', function($parse, $http, $timeout) {
		return {
			restrict: 'A',
			link: function(scope, element, attrs) {

				attrs.type = attrs.type || "video/mp4";
				var src =  $parse(attrs.src);

				var setup = {
					techOrder: ['html5', 'flash'],
					controls: true,
					preload: 'metadata',
					autoplay: false,
					loop: true
				};

				var videoid = 107;
				attrs.id = "videojs" + videoid;
				element.attr('id', attrs.id);

				var player = null;
				attrs.$observe('source', function(value) {
	//				console.log('src changed to "%s", player = %s', value, player);
					if (value) {

						var timeout = $timeout(function() {
							scope.videoLoading = true;
						}, 1000);

						$http({ method: 'HEAD', url: value })
							.success(function() {
	//							console.log(new Date() + ' Back from HEAD, id = %s', attrs.id);
								var src = { type: 'video/mp4', src: value };
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
							})
							.error(function(data, status, headers, config) {
								console.error('Error fetching HEAD of uploaded video: ' + status);
								console.error(data);
							});
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