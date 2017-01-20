"use strict";
/* global angular, THREE, _ */

angular.module('vpdb.dmdstream', [])

	.controller('LiveDmdController', function($scope) {

		$scope.setTitle('Live DMD Streams');
		$scope.theme('dark');

		$scope.renderTargetParameters = {
			minFilter: THREE.LinearFilter,
			magFilter: THREE.LinearFilter,
			format: THREE.RGBFormat,
			stencilBufer: false
		};
		$scope.dotMatrixParams = {
			size: 3,
			blur: 1.3
		};
		$scope.glowParams = {
			amount: 1.6,
			blur: 1
		};

		$scope.dmdIds = [];
		$scope.socket = io('https://api-test.vpdb.io');
		//$scope.socket = io('http://localhost:3000');
		$scope.socket.on('producers', function(dmdIds) {
			$scope.dmdIds = dmdIds;
			console.log('Subscribing to all streams: [ %s ]', dmdIds.join(','));
			_.each(dmdIds, function(id) {
				$scope.socket.emit('subscribe', id);
			});
			$scope.$apply();
		});
		$scope.socket.emit('getProducers');

		$scope.socket.on('producer', function(data) {
			$scope.dmdIds.push(data.id);
			$scope.socket.emit('subscribe', data.id);
			console.log('New stream %s, subscribing.', data.id);
			$scope.$apply();
		});

		$scope.socket.on('stop', function(data) {
			var idx = $scope.dmdIds.indexOf(data.id);
			if (idx > -1) {
				console.log('Removing stream %s', data.id);
				$scope.dmdIds.splice(idx, 1);
			}
			$scope.$apply();
		});

		// setup knobs
		var opts = {
			min: 0,
			max: 10,
			step: 0.2,
			width: 50,
			height: 50,
			displayInput: false,
			angleOffset: -125,
			angleArc: 250,
			fgColor: '#ec843d',
			bgColor: 'rgba(255,255,255,0.1)',
		};
		$('#dotSizeKnob').val($scope.dotMatrixParams.size).knob(_.extend(opts, {
			max: 5,
			step: 0.2,
			change: function (v) {
				$scope.dotMatrixParams.size = v;
				$scope.$broadcast('onParamsChange');
			}
		}));
		$('#dotBlurKnob').val($scope.dotMatrixParams.blur).knob(_.extend(opts, {
			change: function (v) {
				$scope.dotMatrixParams.blur = v;
				$scope.$broadcast('onParamsChange');
			}
		}));
		$('#glowAmountKnob').val($scope.glowParams.amount).knob(_.extend(opts, {
			change: function (v) {
				$scope.glowParams.amount = v;
				$scope.$broadcast('onParamsChange');
			}
		}));
		$('#glowBlurKnob').val($scope.glowParams.blur).knob(_.extend(opts, {
			change: function (v) {
				$scope.glowParams.blur = v;
				$scope.$broadcast('onParamsChange');
			}
		}));
	});
