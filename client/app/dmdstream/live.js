"use strict";
/* global angular, THREE, _ */

angular.module('vpdb.dmdstream', [])

	.controller('LiveDmdController', function($scope) {

		var HSL = rgbToHsl(0xff, 0x6a, 0x00);
		var dmdTexture;
		var dotsComposer;
		var glowComposer;
		var blendComposer;

		$scope.setTitle('Live DMD Streams');
		$scope.theme('dark');

		var socket = io('http://localhost:3000');
		socket.on('gray2frame', function(data) {

			var rgbFrame = new ArrayBuffer(128 * 32 * 3);
			var pos = 0;
			for (var y = 0; y < 32; y++) {
				for (var x = 0; x < 128; x++) {
					var opacity = data[y * 128 + x] / 4;
					var rgb = hslToRgb(HSL[0], HSL[1], opacity * HSL[2]);
					rgbFrame[pos] = rgb[0];
					rgbFrame[pos + 1] = rgb[1];
					rgbFrame[pos + 2] = rgb[2];
					pos += 3;
				}
			}

			dmdTexture.image.data = rgbFrame;
			dmdTexture.needsUpdate = true;

			/*
			dotsComposer.render(0.1);
			glowComposer.render(0.1);
			blendComposer.render(0.1);*/
		});
		socket.emit('subscribe');

		var camera, scene, renderer;
		var renderTargetDots, renderTargetGlow;
		var video, videoTexture, videoMaterial;
		var composer;
		var shaderTime = 0;
		var badTVParams, badTVPass;
		var staticParams, staticPass;
		var rgbParams, rgbPass;
		var filmParams, filmPass;
		var renderPass, copyPass;
		var dotMatrixPass, dotMatrixParams;
		var hblurPass;
		var vblurPass;
		var blendPAss;
		var gui;
		var plane;
		var pnoise, globalParams;

		var dotWidth = 128;
		var dotHeight = 32;
		var ar = dotWidth / dotHeight;

		//animate();

		dotMatrixParams = {
			size: 3,
			blur: 1.3
		};
		var glowParams = {
			amount: 1.6,
			blur: 1
		};
		var perspectiveParams = {
			distance: 615,
			x: 10,
			y: 10
		};

		var init = function() {

			var screen = getDimensions();

			camera = new THREE.PerspectiveCamera(55, ar, 20, 3000);
			camera.position.z = 1000;
			scene = new THREE.Scene();

			//Load Video
			//video = document.createElement('video');
			//video.loop = true;
			//video.src = 'res/dmd-frames-contrast.mp4';
			//video.play();

			//init video texture
			dmdTexture = new THREE.DataTexture([], 0, 0, THREE.RGBFormat);
			dmdTexture.minFilter = THREE.LinearFilter;
			dmdTexture.magFilter = THREE.LinearFilter;

			videoMaterial = new THREE.MeshBasicMaterial({
				map: dmdTexture
			});

			//Add video plane
			var planeGeometry = new THREE.PlaneGeometry(dotWidth, dotHeight, 1, 1);
			var plane = new THREE.Mesh(planeGeometry, videoMaterial);
			scene.add(plane);
			plane.z = 0;
			plane.scale.x = plane.scale.y = 20;

			//init renderer
			renderer = new THREE.WebGLRenderer();
			document.body.appendChild(renderer.domElement);

			// POST PROCESSING

			//common render target params
			var renderTargetParameters = {
				minFilter: THREE.LinearFilter,
				magFilter: THREE.LinearFilter,
				format: THREE.RGBFormat,
				stencilBufer: false
			};

			//Init dotsComposer to render the dots effect
			//A composer is a stack of shader passes combined

			//a render target is an offscreen buffer to save a composer output
			renderTargetDots = new THREE.WebGLRenderTarget(screen.width, screen.height, renderTargetParameters);
			//dots Composer renders the dot effect
			dotsComposer = new THREE.EffectComposer(renderer, renderTargetDots);

			var renderPass = new THREE.RenderPass(scene, camera);
			//a shader pass applies a shader effect to a texture (usually the previous shader output)
			dotMatrixPass = new THREE.ShaderPass(THREE.DotMatrixShader);
			dotsComposer.addPass(renderPass);
			dotsComposer.addPass(dotMatrixPass);

			//Init glowComposer renders a blurred version of the scene
			renderTargetGlow = new THREE.WebGLRenderTarget(screen.width, screen.height, renderTargetParameters);
			glowComposer = new THREE.EffectComposer(renderer, renderTargetGlow);

			//create shader passes
			hblurPass = new THREE.ShaderPass(THREE.HorizontalBlurShader);
			vblurPass = new THREE.ShaderPass(THREE.VerticalBlurShader);

			glowComposer.addPass(renderPass);
			glowComposer.addPass(dotMatrixPass);
			glowComposer.addPass(hblurPass);
			glowComposer.addPass(vblurPass);
			//glowComposer.addPass( fxaaPass );

			//blend Composer runs the AdditiveBlendShader to combine the output of dotsComposer and glowComposer
			var blendPass = new THREE.ShaderPass(THREE.AdditiveBlendShader);
			blendPass.uniforms['tBase'].value = dotsComposer.renderTarget1;
			blendPass.uniforms['tAdd'].value = glowComposer.renderTarget1;
			blendComposer = new THREE.EffectComposer(renderer);
			blendComposer.addPass(blendPass);
			blendPass.renderToScreen = true;

			//////////////

			//Init DAT GUI control panel


			/*
			var gui = new dat.GUI();

			var f1 = gui.addFolder('Dot Matrix');
			f1.add(dotMatrixParams, 'size', 0, 10).step(0.1).onChange(onParamsChange);
			f1.add(dotMatrixParams, 'blur', 0, 10).step(0.1).onChange(onParamsChange);
			f1.open();

			var f2 = gui.addFolder('Glow');
			f2.add(glowParams, 'amount', 0, 10).step(0.1).onChange(onParamsChange);
			f2.add(glowParams, 'blur', 0, 10).step(0.1).onChange(onParamsChange);
			f2.open();
			/*
			 var f3 = gui.addFolder('Perspective');
			 f3.add(perspectiveParams, 'distance', 610, 620).step(0.05).onChange(onParamsChange);
			 f3.add(perspectiveParams, 'x', -20, 20).step(0.1).onChange(onParamsChange);
			 f3.add(perspectiveParams, 'y', -20, 20).step(0.1).onChange(onParamsChange);
			 f3.open();

			gui.close();*/

			window.addEventListener('resize', onResize, false);
			onParamsChange();
			onResize();
			dotMatrixPass.uniforms["resolution"].value = new THREE.Vector2(screen.width, screen.height);
		}

		var onParamsChange = function() {

			//copy gui params into shader uniforms
			dotMatrixPass.uniforms["size"].value = Math.pow(dotMatrixParams.size, 2);
			dotMatrixPass.uniforms["blur"].value = Math.pow(dotMatrixParams.blur * 2, 2);

			hblurPass.uniforms['h'].value = glowParams.blur / screen.width * 2;
			vblurPass.uniforms['v'].value = glowParams.blur / screen.height * 2;
			blendPass.uniforms['amount'].value = glowParams.amount;

			camera.position.x = perspectiveParams.x;
			camera.position.y = perspectiveParams.y;
			camera.position.z = perspectiveParams.distance;
		}

		var onToggleMute = function() {
			video.volume = badTVParams.mute ? 0 : 1;
		}


		var onResize = function() {
			var dim = getDimensions();
			renderTargetDots.width = dim.width;
			renderTargetDots.height = dim.height;
			renderTargetGlow.width = dim.width;
			renderTargetGlow.height = dim.height;

			renderer.setSize(dim.width, dim.height);
			camera.updateProjectionMatrix();
		}

		var getDimensions = function() {
			var windowAR = window.innerWidth / window.innerHeight;
			var width, height;
			if (windowAR > ar) {
				height = window.innerHeight;
				width = window.innerHeight * ar;
			} else {
				width = window.innerWidth;
				height = window.innerWidth / ar;
			}

			console.log(width, height);
			return { width: width, height: height };
		}

		init();

		/**
		 * Converts an HSL color value to RGB. Conversion formula
		 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
		 * Assumes h, s, and l are contained in the set [0, 1] and
		 * returns r, g, and b in the set [0, 255].
		 *
		 * @param   {number}  h       The hue
		 * @param   {number}  s       The saturation
		 * @param   {number}  l       The lightness
		 * @return  {Array}           The RGB representation
		 */
		function hslToRgb(h, s, l) {
			var r, g, b;

			if (s === 0) {
				r = g = b = l; // achromatic
			} else {
				const hue2rgb = function hue2rgb(p, q, t) {
					if (t < 0) t += 1;
					if (t > 1) t -= 1;
					if (t < 1 / 6) return p + (q - p) * 6 * t;
					if (t < 1 / 2) return q;
					if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
					return p;
				};

				const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
				const p = 2 * l - q;
				r = hue2rgb(p, q, h + 1 / 3);
				g = hue2rgb(p, q, h);
				b = hue2rgb(p, q, h - 1 / 3);
			}

			return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
		}

		/**
		 * Converts an RGB color value to HSL. Conversion formula
		 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
		 * Assumes r, g, and b are contained in the set [0, 255] and
		 * returns h, s, and l in the set [0, 1].
		 *
		 * @param   {number}  r       The red color value
		 * @param   {number}  g       The green color value
		 * @param   {number}  b       The blue color value
		 * @return  {Array}           The HSL representation
		 */
		function rgbToHsl(r, g, b) {
			r /= 255;
			g /= 255;
			b /= 255;
			const max = Math.max(r, g, b), min = Math.min(r, g, b);
			var h, s, l = (max + min) / 2;

			if (max == min) {
				h = s = 0; // achromatic
			} else {
				const d = max - min;
				s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
				switch (max) {
					case r:
						h = (g - b) / d + (g < b ? 6 : 0);
						break;
					case g:
						h = (b - r) / d + 2;
						break;
					case b:
						h = (r - g) / d + 4;
						break;
				}
				h /= 6;
			}
			return [h, s, l];
		}
	});
