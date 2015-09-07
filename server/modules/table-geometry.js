/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2015 freezy <freezy@xbmc.org>
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
var im = require('imagemagick');
var gm = require('gm');
var path = require('path');
var THREE = require('three');


/**
 * Returns the four intersection points between the canvas and the 2D projection
 * of the 3D table.
 *
 * @param {object} table Table data containing width, height, inclination, fov,
 *                 xyRotation, xScale, yScale, zScale, xOffset, yOffset, zOffset
 *                 read from the .vpt file.
 * @param {object} imageDimensions Canvas size, containing width and height in pixels
 */
exports.calculateProjection = function(table, imageDimensions) {

};