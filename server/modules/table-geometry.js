/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2016 freezy <freezy@xbmc.org>
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

var _ = require('lodash');
var THREE = require('three');

/**
 * Returns the four intersection points between a canvas and the 2D projection
 * of the 3D table.
 *
 * @param {{ width: number,
 *           height: number,
 *           inclination: number,
 *           fov: number,
 *           xyRotation: number,
 *           xScale: number,
 *           yScale: number,
 *           zScale: number,
 *           xOffset: number,
 *           yOffset: number,
 *           zOffset: number }} table Table data read from the .vpt file.
 * @param {{ width: number,
 *           height: number}}   picDimensions Canvas size
 * @returns {THREE.Geometry} Projected geometry
 */
exports.calculateProjection = function(table, picDimensions) {

	// setup camera
	var camera = new THREE.PerspectiveCamera(table.fov, picDimensions.width / picDimensions.height , 0.1, 10000000);

	// setup rectangle
	var vptRect = createRect(table.width, table.height, 0);
	vptRect.applyMatrix(new THREE.Matrix4().makeRotationX(THREE.Math.degToRad(-table.inclination)));

	// project to camera
	setFov(table.fov, picDimensions.height, vptRect, camera);
	var picRect = projectGeometry(vptRect, camera, picDimensions);
	console.log('Projection: %j', picRect.vertices);

	// scaling to fill screen...
	var postScale = picDimensions.height / (_.max(_.pluck(picRect.vertices, 'y')) - _.min(_.pluck(picRect.vertices, 'y')));
	picRect.applyMatrix(new THREE.Matrix4().makeScale(postScale, postScale, postScale));
	picRect.applyMatrix(new THREE.Matrix4().makeScale(1.02, 1, 1));


	// moving to center
	var mX = (picDimensions.width - _.max(_.pluck(picRect.vertices, 'x')) - _.min(_.pluck(picRect.vertices, 'x'))) / 2;
	var mY = -picRect.vertices[1].y;
	picRect.applyMatrix(new THREE.Matrix4().makeTranslation(mX, mY, 0));
	console.log('Projection (centered): %j', picRect.vertices);

	return picRect;
};


/**
 * Sets the field of vision.
 *
 * In order to keep the size of the projection the same, the distance
 * of the table rectangle is updated (otherwise only size changes).
 *
 * @param {number} fov FOV read from .vpt file
 * @param {number} height Height of the table to display
 * @param {THREE.Geometry} rect Rectangle geometry of the table
 * @param {THREE.PerspectiveCamera} camera Projection camera
 */
function setFov(fov, height, rect, camera) {

	fov *= 0.85;
	var dist = height / (2 * Math.tan(THREE.Math.degToRad(fov / 2)));
	var distD = dist - rect.vertices[0].z;
	rect.applyMatrix(new THREE.Matrix4().makeTranslation(0, 0, distD));
	camera.fov = fov;
	camera.updateProjectionMatrix();
}

/**
 * Creates the table rectangle on the xy-plane with its center at the origin.
 *
 * @param {int} width Width of the table from .vpt file
 * @param {int} height Height of the table from the .vpt file
 * @param {int} z z-position of the rectangle
 * @returns {THREE.Geometry} Rectangle representing the table
 */
function createRect(width, height, z) {
	var rect = new THREE.Geometry();
	rect.vertices.push(
		new THREE.Vector3(width / -2, height / 2, z),
		new THREE.Vector3(width / -2, height / -2, z),
		new THREE.Vector3(width / 2, height / -2, z),
		new THREE.Vector3(width / 2, height / 2, z)
	);
	return rect;
}

/**
 * Projects each vertex of a 3D geometry to a 2D surface using a perspective
 * camera.
 *
 * @param {THREE.Geometry} geometry Geometry to project
 * @param {THREE.PerspectiveCamera} camera Camera to use for projection
 * @param {{width: number, height: number}} screenDim Dimensions of the 2D surface
 * @returns {THREE.Geometry} Projected geometry
 */
function projectGeometry(geometry, camera, screenDim) {
	var p, projection = new THREE.Geometry();
	for (var i = 0; i < geometry.vertices.length; i++) {
		p = projectVector3(geometry.vertices[i], camera, screenDim);
		projection.vertices.push(new THREE.Vector3(p.x, p.y, 0));
	}
	return projection;
}

/**
 * Projects a 3D vector to a 2D surface using a perspective camera.
 *
 * @param {THREE.Vector3} vector Vector to project
 * @param {THREE.PerspectiveCamera} camera Camera to use for projection
 * @param {{width: number, height: number}} screenDim Dimensions of the 2D surface
 * @returns {{x: number, y: number}}
 */
function projectVector3(vector, camera, screenDim) {
	var pos = vector.clone();

	// map to normalized device coordinate (NDC) space
	pos.project(camera);
	return {
		x: Math.round((pos.x + 1) * screenDim.width / 2),
		y: Math.round((-pos.y + 1) * screenDim.height / 2)
	};
}

