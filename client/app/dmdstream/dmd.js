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
			template: '<div class="dmd"></div>',
			controller: function($scope, $element) {

				$scope.width = 128;
				$scope.height = 32;

				var color = new THREE.Color(0xff6a00);
				var hsl = color.getHSL();

				var ar = $scope.width / $scope.height;
				var screen = getDimensions();
				console.log('Setting DMD up for %sx%s.', screen.width, screen.height);

				var camera = new THREE.PerspectiveCamera(55, ar, 20, 3000);
				camera.position.x = 0;
				camera.position.y = 0;
				camera.position.z = 615;

				var scene = new THREE.Scene();

				// texture
				var blankFrame = new Uint8Array($scope.width * $scope.height * 3);
				var dmdTexture = new THREE.DataTexture(blankFrame, $scope.width, $scope.height, THREE.RGBFormat);
				dmdTexture.minFilter = THREE.LinearFilter;
				dmdTexture.magFilter = THREE.LinearFilter;
				var dmdMaterial = new THREE.MeshBasicMaterial({ map: dmdTexture });

				// plane
				var planeGeometry = new THREE.PlaneGeometry($scope.width, $scope.height, 1, 1);
				var dmdMesh = new THREE.Mesh(planeGeometry, dmdMaterial);
				scene.add(dmdMesh);
				dmdMesh.z = 0;
				dmdMesh.scale.x = dmdMesh.scale.y = 20;

				// renderer
				var renderer = new THREE.WebGLRenderer();

				// POST PROCESSING
				// ---------------
				// common render target params
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

				// Init dotsComposer to render the dots effect
				// A composer is a stack of shader passes combined.
				// A render target is an offscreen buffer to save a composer output
				var renderTargetDots = new THREE.WebGLRenderTarget(screen.width, screen.height, $scope.renderTargetParameters);

				// dots Composer renders the dot effect
				var dotsComposer = new THREE.EffectComposer(renderer, renderTargetDots);

				var renderPass = new THREE.RenderPass(scene, camera);

				// a shader pass applies a shader effect to a texture (usually the previous shader output)
				var dotMatrixPass = new THREE.ShaderPass(THREE.DotMatrixShader);
				dotsComposer.addPass(renderPass);
				dotsComposer.addPass(dotMatrixPass);

				// Init glowComposer renders a blurred version of the scene
				var renderTargetGlow = new THREE.WebGLRenderTarget(screen.width, screen.height, $scope.renderTargetParameters);
				var glowComposer = new THREE.EffectComposer(renderer, renderTargetGlow);

				// create shader passes
				var hblurPass = new THREE.ShaderPass(THREE.HorizontalBlurShader);
				var vblurPass = new THREE.ShaderPass(THREE.VerticalBlurShader);

				glowComposer.addPass(renderPass);
				glowComposer.addPass(dotMatrixPass);
				glowComposer.addPass(hblurPass);
				glowComposer.addPass(vblurPass);
				//glowComposer.addPass( fxaaPass );

				// blend Composer runs the AdditiveBlendShader to combine the output of dotsComposer and glowComposer
				var blendPass = new THREE.ShaderPass(THREE.AdditiveBlendShader);
				blendPass.uniforms['tBase'].value = dotsComposer.renderTarget1;
				blendPass.uniforms['tAdd'].value = glowComposer.renderTarget1;

				var blendComposer = new THREE.EffectComposer(renderer);
				blendComposer.addPass(blendPass);
				blendPass.renderToScreen = true;

				$element.append(renderer.domElement);
				window.addEventListener('resize', onResize, false);
				onParamsChange();
				onResize();
				dotMatrixPass.uniforms['resolution'].value = new THREE.Vector2(screen.width, screen.height);

				$scope.socket.on('gray2frame', function(data) {

					if (data.id !== $scope.dmdId || $scope.width === 0 || $scope.height === 0) {
						console.log('%s != %s', data.id, $scope.dmdId);
						return;
					}

					var buffer = new DataView(data.frame);
					var rgbFrame = new Uint8Array($scope.width * $scope.height * 3);
					var pos = 0;
					var dotColor = new THREE.Color();
					for (var y = $scope.height - 1; y >= 0; y--) {
						for (var x = 0; x < $scope.width; x++) {
							var lum = buffer.getUint8(y * $scope.width + x) / 4;
							dotColor.setHSL(hsl.h, hsl.s, lum * hsl.l);
							rgbFrame[pos] = Math.floor(dotColor.r * 255);
							rgbFrame[pos + 1] = Math.floor(dotColor.g * 255);
							rgbFrame[pos + 2] = Math.floor(dotColor.b * 255);
							pos += 3;
						}
					}

					dmdMesh.material.map.image.data = rgbFrame;
					dmdMesh.material.map.needsUpdate = true;
					//dmdMesh.material.needsUpdate = true;

					dotsComposer.render();
					glowComposer.render();
					blendComposer.render();
					//renderer.render(scene, camera);
				});

				$scope.socket.on('dimensions', function(data) {
					if (data.id !== $scope.dmdId) {
						return;
					}
					$scope.width = data.width;
					$scope.height = data.height;
					ar = $scope.width / $scope.height;
					onResize();
				});

				function onParamsChange() {

					//copy gui params into shader uniforms
					dotMatrixPass.uniforms['size'].value = Math.pow($scope.dotMatrixParams.size, 2);
					dotMatrixPass.uniforms['blur'].value = Math.pow($scope.dotMatrixParams.blur * 2, 2);

					hblurPass.uniforms['h'].value = $scope.glowParams.blur / screen.width * 2;
					vblurPass.uniforms['v'].value = $scope.glowParams.blur / screen.height * 2;
					blendPass.uniforms['amount'].value = $scope.glowParams.amount;
				}

				function onResize() {
					var dim = getDimensions();

					renderTargetDots.width = dim.width;
					renderTargetDots.height = dim.height;
					renderTargetGlow.width = dim.width;
					renderTargetGlow.height = dim.height;

					renderer.setSize(dim.width, dim.height);
					camera.updateProjectionMatrix();
				}

				function getDimensions() {
					var containerWidth = $element.parent().width();
					var width, height;
					width = containerWidth;
					height = Math.round(containerWidth / ar);
					return { width: width, height: height };
				}
			}
		};
	});
