/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2017 freezy <freezy@xbmc.org>
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
 */

"use strict";
/* global angular, THREE, _ */

angular.module('vpdb.dmdstream', [])

	.directive('livedmd', function() {
		return {
			restrict: 'E',
			scope: {
				socket: '=',
				dmdId: '=',
			},
			replace: true,
			template: '<div></div>',
			controller: function($scope, $element) {

				var color = new THREE.Color(0xff6a00);
				var hsl = color.getHSL();

				var ar = 128 / 32;

				var camera = new THREE.PerspectiveCamera(55, ar, 20, 3000);
				camera.position.z = 1000;
				var scene = new THREE.Scene();

				// texture
				var blankFrame = new Uint8Array(128 * 32 * 3);
				var dmdTexture = new THREE.DataTexture(blankFrame, 128, 32, THREE.RGBFormat);
				dmdTexture.minFilter = THREE.LinearFilter;
				dmdTexture.magFilter = THREE.LinearFilter;
				var dmdMaterial = new THREE.MeshBasicMaterial({ map: dmdTexture });

				// plane
				var planeGeometry = new THREE.PlaneGeometry(128, 32, 1, 1);
				var dmdMesh = new THREE.Mesh(planeGeometry, dmdMaterial);
				scene.add(dmdMesh);
				dmdMesh.z = 0;
				dmdMesh.scale.x = dmdMesh.scale.y = 20;

				// renderer
				var renderer = new THREE.WebGLRenderer();
				$element.replaceWith(renderer.domElement);

				$scope.socket.on('gray2frame', function(data) {

					if (data.id !== $scope.dmdId) {
						console.log('%s != %s', data.id, $scope.dmdId);
						return;
					}

					var buffer = new DataView(data.frame);
					var rgbFrame = new Uint8Array(128 * 32 * 3);
					var pos = 0;
					var dotColor = new THREE.Color();
					for (var y = 0; y < 32; y++) {
						for (var x = 0; x < 128; x++) {
							var lum = buffer.getUint8(y * 128 + x) / 4;
							dotColor.setHSL(hsl.h, hsl.s, lum * hsl.l);
							rgbFrame[pos] = Math.floor(dotColor.r * 255);
							rgbFrame[pos + 1] = Math.floor(dotColor.g * 255);
							rgbFrame[pos + 2] = Math.floor(dotColor.b * 255);
							pos += 3;
						}
					}

					dmdMesh.material.map.image.data = rgbFrame;
					dmdMesh.material.map.needsUpdate = true;
					dmdMesh.material.needsUpdate = true;

					renderer.render(scene, camera);
				});
			}
		};
	});
