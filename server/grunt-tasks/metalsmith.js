/*
 * VPDB - Visual Pinball Database
 * Copyright (C) 2014 freezy <freezy@xbmc.org>
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

var Metalsmith = require('metalsmith');

module.exports = function(grunt) {

	grunt.registerTask('metalsmith', function() {

		var done = this.async();
		var options = this.options({
			clean: true,
			src: './src',
			dest: './build',
			markdown: {}
		});

		// require plugins
		var collections = require('metalsmith-collections');
		var markdown = require('metalsmith-markdown');
		var sections = require('metalsmith-sections');
		var templates = require('metalsmith-templates');
		var raml = require('./metalsmith/raml');
		var links = require('./metalsmith/links');
		var menu = require('./metalsmith/menu');

		// setup metalsmith
		var metalsmith = new Metalsmith(process.cwd());
		metalsmith.source(options.src);
		metalsmith.destination(options.dest);
		metalsmith.clean(options.clean);

		if (options.metadata) {
			metalsmith.metadata(options.metadata);
		}

		// add plugins

		/* creates metadata.sections based on all index.md files found in the
		 * src folder
		 */
		metalsmith.use(collections({
			sections: {
				pattern: '*/index.md',
				sortBy: 'menuIndex'
			}
		}));

		/* does 2 things:
		 *   1. adds the first folder level ("section") as file.section
		 *   2. creates a sorted list in metadata.subsections[section] of all
		 *      pages of the section (order by subsectionIndex)
		 */
		metalsmith.use(sections({ name: 'subsections' }));

		/* copies the path value of the files key into the file object so we
		 * can access it in other trees as well.
		 */
		metalsmith.use(links({ absolute: true, noext: true }));

		/* generates the api doc */
		metalsmith.use(raml({
			src: 'doc',
			files: {
				'core': { src: 'api/spec/index.raml', dest: 'api/reference' }
			},
			template: 'client/views/devsite/api/resource.jade',
			markdown: markdown
//			section: 'api',
		}));

		/* loops through metalsmith.sections and renders a given template on it */
		metalsmith.use(menu({
			name: 'sections',
			src: 'client/views/devsite/menu.jade',
			dest: 'menu.html'
		}));

		/* renders all .md files to html */
		metalsmith.use(markdown(options.markdown));

		/* puts all .html files into a jade template. */
		metalsmith.use(templates({ engine: 'jade', directory: 'client/views/devsite' }));

		// build
		metalsmith.build(done);
	});
};