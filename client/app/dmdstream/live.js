"use strict";
/* global angular, THREE, _ */

angular.module('vpdb.dmdstream', [])

	.controller('LiveDmdController', function($scope) {

		$scope.setTitle('Live DMD Streams');
		$scope.theme('dark');

		var color = new THREE.Color(0xff6a00);
		var hsl = color.getHSL();

		var HSL = rgbToHsl(0xff, 0x6a, 0x00);
		var ar = 128 / 32;

		var screen = getDimensions();
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

		//init renderer
		var renderer = new THREE.WebGLRenderer();
		document.body.appendChild(renderer.domElement);

		var socket = io('http://localhost:3000');
		socket.on('gray2frame', function(data) {

			var buffer = new DataView(data);
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
		socket.emit('subscribe');

		function getDimensions() {
			var ar = 128 / 32;
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

			return [Math.floor(r * 255), Math.floor(g * 255), Math.floor(b * 255)];
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
