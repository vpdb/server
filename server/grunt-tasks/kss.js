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
var fs = require('fs');
var kss = require('kss');
var jade = require('jade');
var path = require('path');
var async = require('async');
var marked = require('marked');
var html2jade = require('html2jade');
var highlight = require('highlight.js');

var debug = require('debug')('grunt-kss');

var ctrl = require('../controllers/ctrl');
var writeable = require('../modules/writeable');

module.exports = function(grunt) {

	grunt.registerTask('kss', function() {
		var done = this.async();
		kss.traverse('client/styles', { multiline: true, markdown: true, markup: true, mask: '*.styl' }, function(err, styleguide) {
			if (err) {
				throw err;
			}
			var rootRefs = [];

			// print out files to be generated
			grunt.log.writeln('Parsed stylesheets.');
//			grunt.log.writeln(styleguide.data.files.map(function(file) { return '  - ' + file }).join('\n'));

			// accumulate all of the sections' first indexes in case they don't have a root element.
			_.each(styleguide.section('*.'), function(rootSection) {
				var currentRoot = rootSection.reference().match(/[0-9]*\.?/)[0].replace('.', '');
				if (!~rootRefs.indexOf(currentRoot)) {
					rootRefs.push(currentRoot);
				}
			});
			rootRefs.sort(function(a, b) {
				return parseInt(a) - parseInt(b);
			});
			var sectionTemplate = jade.compile(fs.readFileSync('client/app/devsite/styleguide-section.jade'), { pretty: true });

			var renderSection = function(rootSection, reference, sections, next) {
//				grunt.log.writeln('Generating %s %s"', reference, rootSection ? rootSection.header() : 'Unnamed');
				serializeSections(sections, function(err, sections) {
					if (err) {
						grunt.log.error(err);
						return next(err);
					}
					var filename = path.resolve(writeable.devsiteRoot, 'html/styleguide/' + reference + '.html');
					grunt.log.write('Writing "%s"... ', filename);
					fs.writeFileSync(filename, sectionTemplate({
						styleguide: styleguide,
						sections: sections
					}));
					grunt.log.ok();
					next();
				});
			};


			// now, group all of the sections by their root reference, and make a page for each.
			async.each(rootRefs, function(rootRef, next) {

				var rootSection = styleguide.section(rootRef);
				async.each(styleguide.section(new RegExp('^' + rootRef + '\\.\\d+$')), function(section, next) {
					renderSection(rootSection, section.reference(), [ section ].concat(styleguide.section(section.reference() + '.x.x')), next);
				}, next);

			}, function(err) {
				if (err) {
					return done(false);
				}

				var data = _.extend({
					sections: _.map(rootRefs, function(rootRef) {
						return {
							id: rootRef,
							title: styleguide.section(rootRef) ? styleguide.section(rootRef).header() : 'Unnamed',
							childSections: styleguide.section(new RegExp('^' + rootRef + '\\.\\d+$'))
						};
					}),
					pretty: true
				}, ctrl.viewParams());

				// render index
				var indexHtml = jade.renderFile('client/app/devsite/index.jade', data);
				var styleguideMain = jade.renderFile('client/app/devsite/styleguide-main.jade', data);


				// render index (move that to grunt directly)
				var filename = path.resolve(writeable.devsiteRoot, 'index.html');
				grunt.log.write('Writing "%s"... ', filename);
				fs.writeFileSync(filename, indexHtml);
				grunt.log.ok();

				// render main
				filename = path.resolve(writeable.devsiteRoot, 'html/styleguide-main.html');
				//grunt.log.write('Writing "%s"... ', filename);
				fs.writeFileSync(filename, styleguideMain);
				grunt.log.ok();
				done();
			});
		});
	});
};

/**
 * Converts an array of `KssSection` instances to a JS object.
 * @param sections
 * @param done
 * @returns {*}
 */
function serializeSections(sections, done) {
	debug('serializing %d sections..', sections.length);
	async.mapSeries(sections, function(section, next) {
		debug('serializing section %s', section.reference());
		serializeModifiers(section.modifiers(), function(err, modifiers) {
			if (err) {
				console.error(err);
				return next(err);
			}
			toJade(section.markup(), function(err, jade) {
				if (err) {
					console.error(err);
					return next(err);
				}
				debug('converted to jade (%d bytes), returning.', jade.length);
				next(null, {
					header: section.header(),
					description: section.description(),
					reference: section.reference(),
					depth: section.data.refDepth,
					deprecated: section.deprecated(),
					experimental: section.experimental(),
					modifiers: modifiers,
					markup: section.markup(),
					jade: jade
				});
			});
		});
	}, function(err, result) {
		debug('serializeSections finished.');
		done(err, result);
	});
}

/**
 * Converts an array of `KssModifier` instances to a JS object.
 * @param modifiers
 * @param done
 * @returns {*}
 */
function serializeModifiers(modifiers, done) {
	debug('serializing %d modifiers..', modifiers.length);
	async.mapSeries(modifiers, function(modifier, next) {
		toJade(modifier.markup(), function(err, jade) {
			if (err) {
				console.error(err);
				return next(err);
			}
			jade = jade.replace(/html[\s\S]+body[\n\r]+/gi, '');
			jade = ("\n" + jade).replace(/[\n\r]\s{4}/g, '\n');

			var html = modifier.markup();
			next(null, {
				name: modifier.name(),
				description: modifier.description(),
				className: modifier.className(),
				markup: html,
				markupHighlighted: highlight.highlight('html', html).value,
				jade: jade
			});
		});
	}, function(err, result) {
		debug('serializeModifiers finished.');
		done(err, result);
	});
}

function toJade(html, done) {
	if (!html) {
		return done(null, html);
	}
	html2jade.convertHtml(html, {}, function(err, jade) {
		if (err) {
			return done(err);
		}
		done(null, jade);
	});
}

function sectionSort(a, b) {
	var arrA = a.reference().split('.');
	var arrB = b.reference().split('.');
	var i = 0;
	while (parseInt(arrA[i]) === parseInt(arrB[i])) {
		if (++i > arrA.length) {
			return 0;
		}
	}
	return parseInt(arrA[i]) < parseInt(arrB[i]);
}