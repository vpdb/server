"use strict"; /* global directives, videojs */

directives.directive('videojs', function($parse, $http, $timeout) {
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
				if (value && !player) {
					console.log('src changed to %s', value);
					console.log(new Date() + ' Starting HEAD');

					var timeout = $timeout(function() {
						scope.videoLoading = true;
					}, 1000);

					$http({ method: 'HEAD', url: value })
						.success(function() {
							console.log(new Date() + ' Back from HEAD');
							player = videojs(attrs.id, setup, function() {
								this.src({ type: 'video/mp4', src: value });
							});
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
					player.dispose();
				}
			});

			scope.$on('$destroy', function() {
				if (player) {
					player.dispose();
				}
			});


//			//element.attr('poster', "http://10.1.21.36:8080/Testube/media/" + videoid + ".jpg");
//
		}
	};
});