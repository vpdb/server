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

'use strict';

const _ = require('lodash');
const fs = require('fs');
const kss = require('kss');
let pug = require('pug');
const path = require('path');
const async = require('async');
const html2jade = require('html2jade');
const highlight = require('highlight.js');

const debug = require('debug')('grunt-kss');

const ctrl = require('../controllers/ctrl');
const writeable = require('../modules/writeable');

module.exports = function(grunt) {

	grunt.registerTask('kss', function() {
		const done = this.async();
		kss.traverse('client/styles', { multiline: true, markdown: true, markup: true, mask: '*.styl' }, function(err, styleguide) {
			if (err) {
				throw err;
			}
			const rootRefs = [];

			// print out files to be generated
			grunt.log.writeln('Parsed stylesheets.');
			// grunt.log.writeln(styleguide.data.files.map(function(file) { return '  - ' + file }).join('\n'));

			// accumulate all of the sections' first indexes in case they don't have a root element.
			styleguide.section().forEach(function(rootSection) {
				const currentRoot = rootSection.reference().match(/[0-9]*\.?/)[0].replace('.', '');
				if (currentRoot && !~rootRefs.indexOf(currentRoot)) {
					rootRefs.push(currentRoot);
				}
			});
			grunt.log.writeln('%s root references found.', rootRefs.length);
			rootRefs.sort(function(a, b) {
				return parseInt(a) - parseInt(b);
			});
			const sectionTemplate = pug.compile(fs.readFileSync('client/app/devsite/styleguide-section.pug'), { pretty: true });

			const renderSection = function(rootSection, reference, sections, next) {
				grunt.log.writeln('Generating %s %s"', reference, rootSection ? rootSection.header() : 'Unnamed');
				serializeSections(sections, function(err, sections) {
					if (err) {
						grunt.log.error(err);
						return next(err);
					}
					const filename = path.resolve(writeable.devsiteRoot, 'html/styleguide/' + reference + '.html');
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

				const rootSection = styleguide.section(rootRef);
				async.each(styleguide.section(new RegExp('^' + rootRef + '\\.\\d+$')), function(section, next) {
					renderSection(rootSection, section.reference(), [ section ].concat(styleguide.section(section.reference() + '.x.x')), next);
				}, next);

			}, function(err) {
				if (err) {
					return done(false);
				}
				grunt.log.writeln('Sections rendered.');

				const data = _.extend({
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
				const indexHtml = pug.renderFile('client/app/devsite/index.pug', data);
				const styleguideMain = pug.renderFile('client/app/devsite/styleguide-main.pug', data);

				// render index (move that to grunt directly)
				let filename = path.resolve(writeable.devsiteRoot, 'index.html');
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
			toPug(section.markup(), function(err, pug) {
				if (err) {
					console.error(err);
					return next(err);
				}
				debug('converted to pug (%d bytes), returning.', pug.length);
				next(null, {
					header: section.header(),
					description: section.description(),
					reference: section.reference(),
					depth: section.data.refDepth,
					deprecated: section.deprecated(),
					experimental: section.experimental(),
					modifiers: modifiers,
					markup: section.markup(),
					pug: pug
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
		toPug(modifier.markup(), function(err, pug) {
			if (err) {
				console.error(err);
				return next(err);
			}
			pug = pug.replace(/html[\s\S]+body[\n\r]+/gi, '');
			pug = ('\n' + pug).replace(/[\n\r]\s{4}/g, '\n');

			const html = modifier.markup();
			next(null, {
				name: modifier.name(),
				description: modifier.description(),
				className: modifier.className(),
				markup: html,
				markupHighlighted: highlight.highlight('html', html).value,
				pug: pug
			});
		});
	}, function(err, result) {
		debug('serializeModifiers finished.');
		done(err, result);
	});
}

function toPug(html, done) {
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

// eslint-disable-next-line no-unused-vars
function sectionSort(a, b) {
	const arrA = a.reference().split('.');
	const arrB = b.reference().split('.');
	let i = 0;
	while (parseInt(arrA[i]) === parseInt(arrB[i])) {
		if (++i > arrA.length) {
			return 0;
		}
	}
	return parseInt(arrA[i]) < parseInt(arrB[i]);
}