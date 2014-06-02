var _ = require('underscore');
var fs = require('fs');
var kss = require('kss');
var jade = require('jade');
var path = require('path');
var async = require('async');
var marked = require('marked');
var html2jade = require('html2jade');
var highlight = require('highlight.js');

var debug = require('debug')('grunt-kss');

module.exports = function(grunt) {

	grunt.registerTask('kss', function() {
		var done = this.async();
		kss.traverse('client/styles', { multiline: true, markdown: true, markup: true, mask: '*.styl' }, function(err, styleguide) {
			if (err) {
				throw err;
			}
			var rootSections = [];

			// print out files to be generated
			grunt.log.writeln('Parsed stylesheets:');
			grunt.log.writeln(styleguide.data.files.map(function(file) {
				return '  - ' + file
			}).join('\n'));

			// accumulate all of the sections' first indexes in case they don't have a root element.
			_.each(styleguide.section('*.'), function(section) {
				var currentRoot = section.reference().match(/[0-9]*\.?/)[0].replace('.', '');
				if (!~rootSections.indexOf(currentRoot)) {
					rootSections.push(currentRoot);
				}
			});
			rootSections.sort();

			// now, group all of the sections by their root reference, and make a page for each.
			var sectionTemplate = jade.compile(fs.readFileSync('client/views/partials/styleguide-section.jade'), { pretty: true });

			async.each(rootSections, function(rootSection, next) {
				var childSections = styleguide.section(rootSection + '.*');

				grunt.log.writeln('Generating "%s %s"', rootSection, styleguide.section(rootSection) ? styleguide.section(rootSection).header() : 'Unnamed');

				serializesSections(childSections, function(err, sections) {
					if (err) {
						grunt.log.error(err);
						return next(err);
					}
					var filename = path.normalize('styleguide/sections/' + rootSection + '.html');
					grunt.log.write('Writing "%s"... ', filename);
					fs.writeFileSync(filename, sectionTemplate({
						styleguide: styleguide,
						sections: sections,
						rootNumber: rootSection,
						rootSections: rootSections
					}));
					grunt.log.ok();
					next();
				});
			}, function(err) {
				if (err) {
					return done(false);
				}
				// render index
				var indexHtml = jade.renderFile('client/views/styleguide.jade', {
					sections: _.map(rootSections, function(rootSection) {
						return {
							id: rootSection,
							title: styleguide.section(rootSection) ? styleguide.section(rootSection).header() : 'Unnamed',
							childSections: styleguide.section(rootSection + '.*')
						}
					}),
					pretty: true
				});

				var filename = path.normalize('styleguide/index.html');
				grunt.log.write('Writing "%s"... ', filename);
				fs.writeFileSync(filename, indexHtml);
				grunt.log.ok();

				// render overview
				filename = path.normalize('styleguide/overview.html');
				grunt.log.write('Writing "%s"... ', filename);
				fs.writeFileSync(filename, marked(fs.readFileSync('doc/styleguide.md').toString()));
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
function serializesSections(sections, done) {
	debug('serializing %d sections..', sections.length);
	async.mapSeries(sections, function(section, next) {
		debug('serializing section %s', section.reference());
		serializeModifiers(section.modifiers(), function(err, modifiers) {
			if (err) {
				console.error(err);
				return next(err);
			}
			toJade(section.markup(), function(err, jade) {
				debug('continueing 2...');
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
		debug('serializesSections finished.');
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
	var result = html2jade.convertHtml(html, {}, done);
	if (result) {
		done(result);
	}
}