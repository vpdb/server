/*
 * VPDB - Virtual Pinball Database
 * Copyright (C) 2018 freezy <freezy@vpdb.io>
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

export interface FileVariation {
	/**
	 * The name is what's visible, i.e. the part of the file name, like
	 * "square", "medium" etc.
	 */
	name: string;

	/**
	 * The MIME type of the file variation.
	 */
	mimeType?: string;

	/**
	 * A number indicating when to process the variation. This can make
	 * variations that are needed more urgently process before others.
	 * Should be between 0 (hightest) and 100 (lowest).
	 */
	priority?: number;

	/**
	 * References another variation as source. When not set, the original file is the source.
	 */
	source?: string;
}

export interface ImageFileVariation extends FileVariation {

	/**
	 * Encoding quality, 0-100.
	 */
	quality?: number;

	/**
	 * Width in pixels.
	 */
	width?: number;

	/**
	 * Height in pixels.
	 */
	height?: number;

	/**
	 * Size in pixel for square images.
	 */
	size?: number;

	/**
	 * Degrees to rotate the image.
	 */
	rotate?: number;

	/**
	 * If set, generate a square image with {@link size} width and height from a portrait source.
	 */
	portraitToSquare?: boolean;

	/**
	 * If set, generate a square image with {@link size} width and height from a landscape source.
	 */
	wideToSquare?: boolean;

	/**
	 * If set, rotate to landscape if not already in landscape.
	 */
	landscape?: boolean;
}

export interface BackglassVariation extends ImageFileVariation {
	cutGrill?: boolean;
	modulate?: number;
}

export interface VideoFileVariation extends FileVariation {
	width?: number;
	height?: number;
	rotate?: boolean;
	screenshot?: boolean;
	position?: string;
}