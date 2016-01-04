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

"use strict"; /* global angular, _ */

/**
 * Describes the structure of the locally persisted meta data when
 * adding a new release.
 */
angular.module('vpdb.releases.add', []).constant('ReleaseMeta', {

	/**
	 * Serves only for displaying purposes. key: id, value: full object.
	 *
	 * Example data:
	 * {
	 *   "X1bwwuRO":{
	 *     "id":"X1bwwuRO",
	 *     "name":"freezy",
	 *     "gravatar_id":"3216e12a740c59824257efe8b806cc7b",
	 *     "email":"freezy@vpdb.io",
	 *     "is_active":true,
	 *     "provider":"github",
	 *     "roles":[ "root" ],
	 *     "plan":"unlimited",
	 *     "created_at":"2015-03-08T12:23:02.976Z",
	 *     "github":{
	 *       "id":70426,
	 *       "username":"freezy",
	 *       "email":"freezy@xbmc.org",
	 *       "avatar_url":"https://avatars.githubusercontent.com/u/70426?v=3",
	 *       "html_url":"https://github.com/freezy"
	 *     },
	 *     "counter":{ "downloads":0, "comments":1 },
	 *     "permissions":{
	 *       "games":[ "delete", "update", "add" ],
	 *       "ipdb":[ "view" ]
	 *       ...
	 *     }
	 *   }
	 * }
	 */
	users: { },

	/**
	 * Statuses of release files (those dragged and dropped under 1.)
	 *
	 * Example data (coming from file-upload directive, as array):
	 * [
	 *   {
	 *     "name":"test_cabinet.vpt",
	 *     "bytes":606208,
	 *     "mimeType":"application/x-visual-pinball-table",
	 *     "icon":"ext-vpt",
	 *     "uploaded":false,
	 *     "uploading":false,
	 *     "progress":100,
	 *     "text":"Uploading file...",
	 *     "storage":{
	 *       "name":"Flippertest_cabinet.vpt",
	 *       "created_at":"2015-04-12T22:11:36.918Z",
	 *       "mime_type":"application/x-visual-pinball-table",
	 *       "file_type":"release",
	 *       "metadata":{ },
	 *       "id":"V1lt33C7-",
	 *       "url":"/storage/v1/files/V1lt33C7-",
	 *       "bytes":606208,
	 *       "variations":{ },
	 *       "is_protected":true,
	 *       "counter":{ "downloads":0 }
	 *     }
	 *   },
	 *   { ... }
	 * ]
	 *
	 * If you need to gain access to the *release* file while looping through these
	 * meta files, use #getReleaseFile(file).
	 */
	files: [],      // that's the "driving" object, i.e. stuff gets pulled from this and also the view loops over it.

	/**
	 * Statuses of uploaded media (those dragged and dropped under 7.)
	 *
	 * Example data (coming from file-upload directive, as upload):
	 *
	 * {
	 *   "playfield_image:4klWgD1E-": {
	 *     "name":"Attack from Mars (Bally 1995).png",
	 *     "bytes":3994043,
	 *     "mimeType":"image/png",
	 *     "icon":"ext-image",
	 *     "uploaded":false,
	 *     "uploading":false,
	 *     "progress":100,
	 *     "text":"Uploading file...",
	 *     "storage":{
	 *       "name":"Attack from Mars (Bally 1995).png",
	 *       "created_at":"2015-04-12T22:58:00.910Z",
	 *       "mime_type":"image/png",
	 *       "file_type":"playfield-fs",
	 *       "metadata":{ "format":"PNG", "size":{ "width":1920, "height":1080 }, "depth":8 },
	 *       "id":"VkGFqv14Z",
	 *       "url":"/storage/v1/files/VkGFqv14Z",
	 *       "bytes":3994043,
	 *       "variations":{
	 *         "medium":{ "url":"/storage/v1/files/VkGFqv14Z/medium", "is_protected":true },
	 *         "medium-2x":{ "url":"/storage/v1/files/VkGFqv14Z/medium-2x", "is_protected":true },
	 *         ...
	 *       },
	 *       "is_protected":true,
	 *       "counter":{ "downloads":0 }
	 *       },
	 *     }
	 *     "key":"playfield_image:4klWgD1E-"
	 *   }
	 * }
	 *
	 * Since media files are linked to a table file, a link must be made.
	 * Instead of adding custom data to the status object, this information for
	 * now sits in the ID, which is <media_type>:<table_file_id>.
	 *
	 * Note this data gets copied into the release object as soon as the status
	 * is returned from the file upload module (see #onMediaUpload(status)).
	 */
	mediaFiles: {},

	/**
	 * Since we have different links for different file types (e.g. playfield image uses variation medium-landscape
	 * while playfield video uses variation.still), we save them separately for easy access.
	 *
	 * Example data:
	 *
	 * {
	 *   "playfield_image:4klWgD1E-":{
	 *     "url":"/storage/v1/files/VkGFqv14Z/medium-landscape",
	 *     "is_protected":true
	 *   }
	 * }
	 */
	mediaLinks: {},


	tags: []       // also driving object. on drop and remove, ids get copied into release object from here.

});